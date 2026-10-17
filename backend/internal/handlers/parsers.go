package handlers

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"

	"birrpulse/internal/db"
	"birrpulse/internal/httpx"
)

// Parsers serves bank-SMS parser configuration to the app and lets an admin maintain it.
// Fixing a changed bank message format then needs no app release.
type Parsers struct {
	Store      *db.Store
	AdminToken string
}

type Template struct {
	ID         string `json:"id" bson:"id"`
	Direction  string `json:"direction" bson:"direction"` // credit | debit
	Pattern    string `json:"pattern" bson:"pattern"`     // RE2/JS compatible, named groups: amount fee vat balance ref counterparty tail
	Flags      string `json:"flags,omitempty" bson:"flags,omitempty"`
	Channel    string `json:"channel,omitempty" bson:"channel,omitempty"`
	IncomeKind string `json:"incomeKind,omitempty" bson:"incomeKind,omitempty"`
}

type Bank struct {
	Code      string     `json:"code" bson:"bankCode"`
	Name      string     `json:"name" bson:"name"`
	Short     string     `json:"short" bson:"short"`
	Color     string     `json:"color" bson:"color"`
	Senders   []string   `json:"senders" bson:"senders"`
	BodyHints []string   `json:"bodyHints" bson:"bodyHints"`
	Templates []Template `json:"templates" bson:"templates"`
	Active    bool       `json:"active" bson:"active"`
	Version   int        `json:"version" bson:"version"`
	UpdatedAt int64      `json:"updatedAt" bson:"updatedAt"`
}

var (
	codeRe  = regexp.MustCompile(`^[A-Z0-9_]{2,16}$`)
	colorRe = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
	idRe    = regexp.MustCompile(`^[a-z0-9_-]{1,32}$`)

	allowedGroups   = map[string]bool{"amount": true, "fee": true, "vat": true, "balance": true, "ref": true, "counterparty": true, "tail": true}
	allowedChannels = map[string]bool{"": true, "deposit": true, "withdrawal": true, "transfer": true, "payment": true, "airtime": true, "fee": true, "other": true}
)

// checkPattern makes sure a pattern compiles with RE2 (linear time) and only uses syntax that behaves
// the same in JavaScript, because the phone runs it with the JS engine.
func checkPattern(p, flags string, max int) (*regexp.Regexp, error) {
	if p == "" || len(p) > max {
		return nil, fmt.Errorf("pattern must be 1 to %d characters", max)
	}
	if flags != "" && flags != "i" {
		return nil, fmt.Errorf("flags must be empty or \"i\"")
	}
	for _, bad := range []string{`[[:`, `\p`, `\P`, `\A`, `\z`, `\Q`, `\E`} {
		if strings.Contains(p, bad) {
			return nil, fmt.Errorf("syntax %q is not supported on the phone", bad)
		}
	}
	for i := 0; i+1 < len(p); i++ {
		if p[i] == '\\' {
			i++
			continue
		}
		if p[i] == '(' && p[i+1] == '?' {
			rest := p[i:]
			if !strings.HasPrefix(rest, "(?:") && !strings.HasPrefix(rest, "(?<") {
				return nil, fmt.Errorf("only (?:...) and (?<name>...) groups are supported")
			}
		}
	}
	prefix := ""
	if flags == "i" {
		prefix = "(?i)"
	}
	return regexp.Compile(prefix + p)
}

func validateBank(b *Bank) error {
	if !codeRe.MatchString(b.Code) {
		return fmt.Errorf("bank code must be 2-16 characters A-Z, 0-9 or _")
	}
	if len(b.Name) == 0 || len(b.Name) > 60 || len(b.Short) == 0 || len(b.Short) > 8 {
		return fmt.Errorf("name (max 60) and short (max 8) are required")
	}
	if !colorRe.MatchString(b.Color) {
		return fmt.Errorf("color must look like #3A8D87")
	}
	if len(b.Senders) > 20 || len(b.BodyHints) > 10 || len(b.Templates) > 30 {
		return fmt.Errorf("too many senders, hints or templates")
	}
	for _, s := range b.Senders {
		if len(s) == 0 || len(s) > 32 {
			return fmt.Errorf("sender IDs must be 1 to 32 characters")
		}
	}
	for _, h := range b.BodyHints {
		if _, err := checkPattern(h, "i", 120); err != nil {
			return fmt.Errorf("bodyHint %q: %w", h, err)
		}
	}
	seen := map[string]bool{}
	for _, t := range b.Templates {
		if !idRe.MatchString(t.ID) || seen[t.ID] {
			return fmt.Errorf("template ids must be unique and match [a-z0-9_-]{1,32}")
		}
		seen[t.ID] = true
		if t.Direction != "credit" && t.Direction != "debit" {
			return fmt.Errorf("template %s: direction must be credit or debit", t.ID)
		}
		if !allowedChannels[t.Channel] || (t.IncomeKind != "" && t.IncomeKind != "salary") {
			return fmt.Errorf("template %s: invalid channel or incomeKind", t.ID)
		}
		re, err := checkPattern(t.Pattern, t.Flags, 600)
		if err != nil {
			return fmt.Errorf("template %s: %w", t.ID, err)
		}
		hasAmount := false
		for _, n := range re.SubexpNames() {
			if n == "" {
				continue
			}
			if !allowedGroups[n] {
				return fmt.Errorf("template %s: unknown group %q", t.ID, n)
			}
			if n == "amount" {
				hasAmount = true
			}
		}
		if !hasAmount {
			return fmt.Errorf("template %s: pattern needs an (?<amount>...) group", t.ID)
		}
	}
	return nil
}

func version(banks []Bank) string {
	sort.Slice(banks, func(i, j int) bool { return banks[i].Code < banks[j].Code })
	h := sha256.New()
	for _, b := range banks {
		fmt.Fprintf(h, "%s:%d:%d;", b.Code, b.Version, b.UpdatedAt)
	}
	return hex.EncodeToString(h.Sum(nil))[:12]
}

// Public returns the active parser configuration. Pass ?v=<version> to get {"unchanged":true} when nothing changed.
func (h *Parsers) Public(w http.ResponseWriter, r *http.Request) {
	cur, err := h.Store.Col(db.Parsers).Find(r.Context(), bson.M{"active": true})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "query failed")
		return
	}
	banks := []Bank{}
	if err := cur.All(r.Context(), &banks); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "query failed")
		return
	}
	v := version(banks)
	w.Header().Set("Cache-Control", "public, max-age=300")
	if r.URL.Query().Get("v") == v {
		httpx.JSON(w, http.StatusOK, map[string]any{"unchanged": true, "version": v})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"version": v, "banks": banks})
}

func (h *Parsers) admin(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if h.AdminToken == "" {
			http.NotFound(w, r)
			return
		}
		if subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Admin-Token")), []byte(h.AdminToken)) != 1 {
			httpx.Error(w, http.StatusUnauthorized, "invalid admin token")
			return
		}
		next(w, r)
	})
}

func (h *Parsers) AdminList() http.Handler {
	return h.admin(func(w http.ResponseWriter, r *http.Request) {
		cur, err := h.Store.Col(db.Parsers).Find(r.Context(), bson.M{}, options.Find().SetSort(bson.D{{Key: "bankCode", Value: 1}}))
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "query failed")
			return
		}
		banks := []Bank{}
		if err := cur.All(r.Context(), &banks); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "query failed")
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"banks": banks})
	})
}

func (h *Parsers) AdminPut() http.Handler {
	return h.admin(func(w http.ResponseWriter, r *http.Request) {
		var in Bank
		if err := httpx.Decode(w, r, &in); err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		in.Code = strings.ToUpper(r.PathValue("bankCode"))
		if in.Senders == nil {
			in.Senders = []string{}
		}
		if in.BodyHints == nil {
			in.BodyHints = []string{}
		}
		if in.Templates == nil {
			in.Templates = []Template{}
		}
		if err := validateBank(&in); err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		set := bson.M{"bankCode": in.Code, "name": in.Name, "short": in.Short, "color": in.Color, "senders": in.Senders,
			"bodyHints": in.BodyHints, "templates": in.Templates, "active": in.Active, "updatedAt": time.Now().UnixMilli()}
		_, err := h.Store.Col(db.Parsers).UpdateOne(r.Context(), bson.M{"bankCode": in.Code},
			bson.M{"$set": set, "$inc": bson.M{"version": 1}}, options.Update().SetUpsert(true))
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not save")
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]bool{"saved": true})
	})
}

func (h *Parsers) AdminDelete() http.Handler {
	return h.admin(func(w http.ResponseWriter, r *http.Request) {
		_, err := h.Store.Col(db.Parsers).DeleteOne(r.Context(), bson.M{"bankCode": strings.ToUpper(r.PathValue("bankCode"))})
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not delete")
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]bool{"deleted": true})
	})
}

// AdminTest runs a pattern against a sample SMS so a new template can be checked before it is published.
func (h *Parsers) AdminTest() http.Handler {
	return h.admin(func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Pattern string `json:"pattern"`
			Flags   string `json:"flags"`
			Body    string `json:"body"`
		}
		if err := httpx.Decode(w, r, &in); err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		re, err := checkPattern(in.Pattern, in.Flags, 600)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		body := strings.Join(strings.Fields(in.Body), " ")
		m := re.FindStringSubmatch(body)
		groups := map[string]string{}
		if m != nil {
			for i, n := range re.SubexpNames() {
				if n != "" {
					groups[n] = m[i]
				}
			}
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"matched": m != nil, "groups": groups})
	})
}
