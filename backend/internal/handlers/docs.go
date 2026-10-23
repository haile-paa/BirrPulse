package handlers

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"birrpulse/internal/auth"
	"birrpulse/internal/db"
	"birrpulse/internal/httpx"
)

// All money values are integer minor units (cents). Times are Unix milliseconds.
const maxMoney = int64(10_000_000_000_000)

type spec struct {
	required []string
	allowed  map[string]bool
	money    []string
	times    []string
	enums    map[string][]string
}

func allow(names ...string) map[string]bool {
	m := map[string]bool{"id": true, "updatedAt": true, "deleted": true}
	for _, n := range names {
		m[n] = true
	}
	return m
}

var workspaces = []string{"personal", "business"}

var specs = map[string]spec{
	"accounts": {
		required: []string{"bankCode", "nickname"},
		allowed:  allow("bankCode", "nickname", "tail", "verifiedBalance", "calcBalance", "workspace"),
		money:    []string{"calcBalance"},
		enums:    map[string][]string{"workspace": workspaces},
	},
	"transactions": {
		required: []string{"accountId", "type", "amount", "occurredAt", "categoryId"},
		allowed: allow("accountId", "type", "channel", "amount", "fee", "balanceAfter", "categoryId", "incomeKind", "counterparty",
			"ref", "occurredAt", "source", "dedupeHash", "note", "workspace", "transferGroup", "debtId"),
		money: []string{"amount", "fee", "balanceAfter"},
		times: []string{"occurredAt"},
		enums: map[string][]string{
			"type": {"income", "expense", "transfer"}, "workspace": workspaces, "source": {"sms", "manual"},
			"channel": {"deposit", "withdrawal", "transfer", "payment", "airtime", "fee", "other"},
		},
	},
	"budgets": {
		required: []string{"period", "limit"},
		allowed:  allow("categoryId", "period", "limit", "workspace"),
		money:    []string{"limit"},
		enums:    map[string][]string{"period": {"daily", "weekly", "monthly"}, "workspace": workspaces},
	},
	"debts": {
		required: []string{"direction", "person", "principal"},
		allowed:  allow("direction", "person", "principal", "repayments", "dueDate", "note", "workspace", "sourceTxId"),
		money:    []string{"principal"},
		times:    []string{"dueDate"},
		enums:    map[string][]string{"direction": {"borrowed", "lent"}, "workspace": workspaces},
	},
	"goals": {
		required: []string{"name", "target"},
		allowed:  allow("name", "icon", "target", "saved", "deadline"),
		money:    []string{"target", "saved"},
		times:    []string{"deadline"},
	},
	"bills": {
		required: []string{"name", "amount", "nextDue"},
		allowed:  allow("name", "icon", "amount", "repeat", "nextDue", "categoryId", "workspace"),
		money:    []string{"amount"},
		times:    []string{"nextDue"},
		enums:    map[string][]string{"repeat": {"monthly", "weekly", "once"}, "workspace": workspaces},
	},
}

func toInt(v any) (int64, bool) {
	switch n := v.(type) {
	case float64:
		if n != math.Trunc(n) || math.Abs(n) > 1e15 {
			return 0, false
		}
		return int64(n), true
	case int64:
		return n, true
	case int32:
		return int64(n), true
	case int:
		return int64(n), true
	}
	return 0, false
}

func cleanRepayments(v any) ([]bson.M, error) {
	list, ok := v.([]any)
	if !ok {
		return nil, errors.New("repayments must be a list")
	}
	if len(list) > 500 {
		return nil, errors.New("too many repayments")
	}
	out := make([]bson.M, 0, len(list))
	for _, it := range list {
		m, ok := it.(map[string]any)
		if !ok {
			return nil, errors.New("invalid repayment")
		}
		id, _ := m["id"].(string)
		amt, okA := toInt(m["amount"])
		at, okT := toInt(m["at"])
		if id == "" || !okA || !okT || amt < 0 || amt > maxMoney {
			return nil, errors.New("invalid repayment")
		}
		rep := bson.M{"id": id, "amount": amt, "at": at}
		if tx, _ := m["txId"].(string); tx != "" && len(tx) <= 64 {
			rep["txId"] = tx
		}
		out = append(out, rep)
	}
	return out, nil
}

func cleanVerified(v any) (bson.M, error) {
	m, ok := v.(map[string]any)
	if !ok {
		return nil, errors.New("verifiedBalance must be an object")
	}
	amt, okA := toInt(m["amount"])
	at, okT := toInt(m["at"])
	if !okA || !okT || amt > maxMoney || amt < -maxMoney {
		return nil, errors.New("invalid verifiedBalance")
	}
	return bson.M{"amount": amt, "at": at}, nil
}

// normalize whitelists fields, validates types and ranges, and stamps server-side fields.
func normalize(col string, in map[string]any, uid primitive.ObjectID, now int64) (bson.M, error) {
	sp, ok := specs[col]
	if !ok {
		return nil, errors.New("unknown collection")
	}
	out := bson.M{}
	for k, v := range in {
		if sp.allowed[k] && v != nil {
			out[k] = v
		}
	}
	if id, _ := out["id"].(string); id == "" || len(id) > 64 {
		return nil, errors.New("id is required (max 64 characters)")
	}
	for _, f := range sp.required {
		if _, ok := out[f]; !ok {
			return nil, fmt.Errorf("%s is required", f)
		}
	}
	for _, f := range sp.money {
		if v, ok := out[f]; ok {
			n, ok := toInt(v)
			if !ok || n > maxMoney || n < -maxMoney {
				return nil, fmt.Errorf("%s must be an integer amount in minor units", f)
			}
			out[f] = n
		}
	}
	for _, f := range sp.times {
		if v, ok := out[f]; ok {
			n, ok := toInt(v)
			if !ok || n < 0 {
				return nil, fmt.Errorf("%s must be a Unix millisecond timestamp", f)
			}
			out[f] = n
		}
	}
	for f, allowedVals := range sp.enums {
		if v, ok := out[f]; ok {
			s, _ := v.(string)
			found := false
			for _, a := range allowedVals {
				if a == s {
					found = true
				}
			}
			if !found {
				return nil, fmt.Errorf("invalid value for %s", f)
			}
		}
	}
	for k, v := range out {
		if s, ok := v.(string); ok && len(s) > 500 {
			return nil, fmt.Errorf("%s is too long", k)
		}
	}
	if v, ok := out["amount"]; ok && col == "transactions" {
		if n := v.(int64); n < 0 {
			return nil, errors.New("amount must not be negative")
		}
	}
	if v, ok := out["repayments"]; ok {
		r, err := cleanRepayments(v)
		if err != nil {
			return nil, err
		}
		out["repayments"] = r
	}
	if v, ok := out["verifiedBalance"]; ok {
		r, err := cleanVerified(v)
		if err != nil {
			return nil, err
		}
		out["verifiedBalance"] = r
	}
	if v, ok := out["deleted"]; ok {
		if _, isBool := v.(bool); !isBool {
			return nil, errors.New("deleted must be true or false")
		}
	}
	u := now
	if v, ok := out["updatedAt"]; ok {
		n, ok := toInt(v)
		if !ok || n <= 0 {
			return nil, errors.New("updatedAt must be a Unix millisecond timestamp")
		}
		u = n
	}
	if u > now+5*60*1000 { // never trust clocks more than 5 minutes in the future
		u = now
	}
	out["updatedAt"] = u
	out["userId"] = uid
	out["syncedAt"] = now
	return out, nil
}

// public removes server-only fields before a document leaves the API.
func public(d bson.M) {
	delete(d, "_id")
	delete(d, "userId")
	delete(d, "syncedAt")
}

// upsertLWW writes a document unless the stored one is newer (last write wins on updatedAt).
func upsertLWW(r *http.Request, s *db.Store, col string, doc bson.M) error {
	c := s.Col(col)
	res, err := c.UpdateOne(r.Context(),
		bson.M{"userId": doc["userId"], "id": doc["id"], "updatedAt": bson.M{"$lt": doc["updatedAt"]}},
		bson.M{"$set": doc})
	if err != nil {
		return err
	}
	if res.MatchedCount > 0 {
		return nil
	}
	if _, err := c.InsertOne(r.Context(), doc); err != nil && !mongo.IsDuplicateKeyError(err) {
		return err // a duplicate means an equal or newer version already exists: nothing to do
	}
	return nil
}

type Docs struct{ Store *db.Store }

func (h *Docs) List(col string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		filter := bson.M{"userId": auth.UserID(r.Context())}
		if q.Get("includeDeleted") != "1" {
			filter["deleted"] = bson.M{"$ne": true}
		}
		if since, err := strconv.ParseInt(q.Get("since"), 10, 64); err == nil {
			filter["syncedAt"] = bson.M{"$gt": since}
		}
		limit := int64(100)
		if l, err := strconv.ParseInt(q.Get("limit"), 10, 64); err == nil && l > 0 && l <= 500 {
			limit = l
		}
		sort := bson.D{{Key: "updatedAt", Value: -1}}
		if col == "transactions" {
			sort = bson.D{{Key: "occurredAt", Value: -1}}
			if before, err := strconv.ParseInt(q.Get("before"), 10, 64); err == nil {
				filter["occurredAt"] = bson.M{"$lt": before}
			}
		}
		cur, err := h.Store.Col(col).Find(r.Context(), filter, options.Find().SetSort(sort).SetLimit(limit))
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "query failed")
			return
		}
		items := []bson.M{}
		if err := cur.All(r.Context(), &items); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "query failed")
			return
		}
		for _, d := range items {
			public(d)
		}
		httpx.JSON(w, http.StatusOK, map[string]any{"items": items, "count": len(items)})
	}
}

func (h *Docs) Create(col string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in map[string]any
		if err := httpx.Decode(w, r, &in); err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		if _, ok := in["id"]; !ok {
			in["id"] = primitive.NewObjectID().Hex()
		}
		doc, err := normalize(col, in, auth.UserID(r.Context()), time.Now().UnixMilli())
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		if _, err := h.Store.Col(col).InsertOne(r.Context(), doc); err != nil {
			if mongo.IsDuplicateKeyError(err) {
				httpx.Error(w, http.StatusConflict, "a record with this id (or dedupeHash) already exists")
				return
			}
			httpx.Error(w, http.StatusInternalServerError, "could not save")
			return
		}
		public(doc)
		httpx.JSON(w, http.StatusCreated, doc)
	}
}

func (h *Docs) find(r *http.Request, col string) (bson.M, error) {
	var d bson.M
	err := h.Store.Col(col).FindOne(r.Context(), bson.M{"userId": auth.UserID(r.Context()), "id": r.PathValue("id")}).Decode(&d)
	return d, err
}

func (h *Docs) Get(col string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		d, err := h.find(r, col)
		if err != nil {
			httpx.Error(w, http.StatusNotFound, "not found")
			return
		}
		public(d)
		httpx.JSON(w, http.StatusOK, d)
	}
}

func (h *Docs) Patch(col string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in map[string]any
		if err := httpx.Decode(w, r, &in); err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		cur, err := h.find(r, col)
		if err != nil {
			httpx.Error(w, http.StatusNotFound, "not found")
			return
		}
		merged := map[string]any{}
		for k, v := range cur {
			merged[k] = v
		}
		for k, v := range in {
			merged[k] = v
		}
		merged["id"] = r.PathValue("id")
		merged["updatedAt"] = time.Now().UnixMilli()
		// Existing documents come back from BSON with their stored Go types; normalize them through JSON-like values.
		doc, err := normalize(col, toJSONish(merged), auth.UserID(r.Context()), time.Now().UnixMilli())
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		if _, err := h.Store.Col(col).ReplaceOne(r.Context(), bson.M{"userId": doc["userId"], "id": doc["id"]}, doc); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not save")
			return
		}
		public(doc)
		httpx.JSON(w, http.StatusOK, doc)
	}
}

// Delete is a soft delete so that other devices learn about it on their next sync.
func (h *Docs) Delete(col string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		now := time.Now().UnixMilli()
		res, err := h.Store.Col(col).UpdateOne(r.Context(),
			bson.M{"userId": auth.UserID(r.Context()), "id": r.PathValue("id")},
			bson.M{"$set": bson.M{"deleted": true, "updatedAt": now, "syncedAt": now}})
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not delete")
			return
		}
		if res.MatchedCount == 0 {
			httpx.Error(w, http.StatusNotFound, "not found")
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]bool{"deleted": true})
	}
}

// toJSONish converts BSON-typed values (primitive.A, primitive.M, int32) into the shapes encoding/json produces.
func toJSONish(v any) map[string]any {
	var conv func(any) any
	conv = func(x any) any {
		switch t := x.(type) {
		case primitive.A:
			out := make([]any, len(t))
			for i := range t {
				out[i] = conv(t[i])
			}
			return out
		case primitive.M:
			out := map[string]any{}
			for k, val := range t {
				out[k] = conv(val)
			}
			return out
		case map[string]any:
			out := map[string]any{}
			for k, val := range t {
				out[k] = conv(val)
			}
			return out
		case int32:
			return float64(t)
		case int64:
			return float64(t)
		default:
			return x
		}
	}
	return conv(v).(map[string]any)
}

type syncChange struct {
	Collection string `json:"collection"`
	ID         string `json:"id"`
	Error      string `json:"error"`
}

// Push accepts batches of local changes from a device.
func (h *Docs) Push(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Changes map[string][]map[string]any `json:"changes"`
	}
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	uid := auth.UserID(r.Context())
	now := time.Now().UnixMilli()
	accepted := 0
	rejected := []syncChange{}
	for col, docs := range in.Changes {
		if _, ok := specs[col]; !ok {
			httpx.Error(w, http.StatusBadRequest, "unknown collection: "+col)
			return
		}
		if len(docs) > 1000 {
			httpx.Error(w, http.StatusRequestEntityTooLarge, "at most 1000 documents per collection per push")
			return
		}
		for _, d := range docs {
			id, _ := d["id"].(string)
			doc, err := normalize(col, d, uid, now)
			if err == nil {
				err = upsertLWW(r, h.Store, col, doc)
			}
			if err != nil {
				rejected = append(rejected, syncChange{Collection: col, ID: id, Error: err.Error()})
				continue
			}
			accepted++
		}
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"accepted": accepted, "rejected": rejected, "serverTime": time.Now().UnixMilli()})
}

// Pull returns every document written since the given server timestamp.
func (h *Docs) Pull(w http.ResponseWriter, r *http.Request) {
	since, _ := strconv.ParseInt(r.URL.Query().Get("since"), 10, 64)
	uid := auth.UserID(r.Context())
	serverTime := time.Now().UnixMilli() // taken before reading so concurrent writes are never skipped
	changes := map[string][]bson.M{}
	for _, col := range db.SyncCollections {
		cur, err := h.Store.Col(col).Find(r.Context(), bson.M{"userId": uid, "syncedAt": bson.M{"$gt": since}},
			options.Find().SetSort(bson.D{{Key: "syncedAt", Value: 1}}).SetLimit(20000))
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "query failed")
			return
		}
		docs := []bson.M{}
		if err := cur.All(r.Context(), &docs); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "query failed")
			return
		}
		for _, d := range docs {
			public(d)
		}
		changes[col] = docs
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"serverTime": serverTime, "changes": changes})
}
