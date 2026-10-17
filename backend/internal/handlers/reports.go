package handlers

import (
	"encoding/csv"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"birrpulse/internal/auth"
	"birrpulse/internal/db"
	"birrpulse/internal/httpx"
)

type Reports struct{ Store *db.Store }

const tzName = "Africa/Addis_Ababa"

func location() *time.Location {
	if l, err := time.LoadLocation(tzName); err == nil {
		return l
	}
	return time.FixedZone("EAT", 3*3600)
}

// window returns the requested [from,to) range in Unix ms; it defaults to the current month.
func window(r *http.Request) (int64, int64) {
	loc := location()
	now := time.Now().In(loc)
	from := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc).UnixMilli()
	to := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, loc).UnixMilli()
	if v, err := strconv.ParseInt(r.URL.Query().Get("from"), 10, 64); err == nil {
		from = v
	}
	if v, err := strconv.ParseInt(r.URL.Query().Get("to"), 10, 64); err == nil {
		to = v
	}
	return from, to
}

func (h *Reports) match(r *http.Request, internalOnly, excludeInternal bool) bson.M {
	from, to := window(r)
	m := bson.M{"userId": auth.UserID(r.Context()), "deleted": bson.M{"$ne": true}, "occurredAt": bson.M{"$gte": from, "$lt": to}}
	if ws := r.URL.Query().Get("workspace"); ws == "personal" || ws == "business" {
		m["workspace"] = ws
	}
	if excludeInternal {
		return bson.M{"$and": bson.A{m, bson.M{"$or": bson.A{
			bson.M{"transferGroup": bson.M{"$exists": false}}, bson.M{"transferGroup": nil}, bson.M{"transferGroup": ""},
		}}}}
	}
	return m
}

func (h *Reports) run(r *http.Request, pipe mongo.Pipeline, out any) error {
	cur, err := h.Store.Col("transactions").Aggregate(r.Context(), pipe)
	if err != nil {
		return err
	}
	return cur.All(r.Context(), out)
}

// Summary returns income, expenses, deposits, withdrawals and transaction fees for the period.
func (h *Reports) Summary(w http.ResponseWriter, r *http.Request) {
	var rows []struct {
		ID struct {
			Type     string `bson:"type"`
			Channel  string `bson:"channel"`
			Internal bool   `bson:"internal"`
		} `bson:"_id"`
		Amount int64 `bson:"amount"`
		Fee    int64 `bson:"fee"`
		Count  int64 `bson:"count"`
	}
	pipe := mongo.Pipeline{
		{{Key: "$match", Value: h.match(r, false, false)}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: bson.D{
				{Key: "type", Value: "$type"}, {Key: "channel", Value: "$channel"},
				{Key: "internal", Value: bson.D{{Key: "$gt", Value: bson.A{bson.D{{Key: "$strLenCP", Value: bson.D{{Key: "$ifNull", Value: bson.A{"$transferGroup", ""}}}}}, 0}}}},
			}},
			{Key: "amount", Value: bson.D{{Key: "$sum", Value: "$amount"}}},
			{Key: "fee", Value: bson.D{{Key: "$sum", Value: bson.D{{Key: "$ifNull", Value: bson.A{"$fee", 0}}}}}},
			{Key: "count", Value: bson.D{{Key: "$sum", Value: 1}}},
		}}},
	}
	if err := h.run(r, pipe, &rows); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "report failed")
		return
	}
	var income, expense, fees, deposits, withdrawals, count int64
	for _, row := range rows {
		fees += row.Fee
		count += row.Count
		if row.ID.Channel == "deposit" {
			deposits += row.Amount
		}
		if row.ID.Channel == "withdrawal" {
			withdrawals += row.Amount
		}
		if row.ID.Internal {
			continue // own-account transfers are not income or spending
		}
		switch row.ID.Type {
		case "income":
			income += row.Amount
		case "expense":
			expense += row.Amount + row.Fee
		}
	}
	from, to := window(r)
	httpx.JSON(w, http.StatusOK, map[string]any{
		"from": from, "to": to, "income": income, "expense": expense, "net": income - expense,
		"fees": fees, "deposits": deposits, "withdrawals": withdrawals, "transactions": count,
		"note": "Calculated from tracked transactions; not a verified bank statement.",
	})
}

// Categories returns spending (or income) per category, largest first.
func (h *Reports) Categories(w http.ResponseWriter, r *http.Request) {
	typ := "expense"
	if r.URL.Query().Get("type") == "income" {
		typ = "income"
	}
	base := h.match(r, false, true)
	pipe := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"$and": bson.A{base, bson.M{"type": typ}}}}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$categoryId"},
			{Key: "total", Value: bson.D{{Key: "$sum", Value: bson.D{{Key: "$add", Value: bson.A{"$amount", bson.D{{Key: "$ifNull", Value: bson.A{"$fee", 0}}}}}}}}},
			{Key: "count", Value: bson.D{{Key: "$sum", Value: 1}}},
		}}},
		{{Key: "$sort", Value: bson.D{{Key: "total", Value: -1}}}},
	}
	var rows []bson.M
	if err := h.run(r, pipe, &rows); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "report failed")
		return
	}
	out := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		out = append(out, map[string]any{"categoryId": row["_id"], "total": row["total"], "count": row["count"]})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"type": typ, "items": out})
}

// Cashflow returns income and expenses per month for the last N months (default 6).
func (h *Reports) Cashflow(w http.ResponseWriter, r *http.Request) {
	months := 6
	if n, err := strconv.Atoi(r.URL.Query().Get("months")); err == nil && n > 0 && n <= 24 {
		months = n
	}
	loc := location()
	now := time.Now().In(loc)
	start := time.Date(now.Year(), now.Month()-time.Month(months-1), 1, 0, 0, 0, 0, loc)
	m := bson.M{"userId": auth.UserID(r.Context()), "deleted": bson.M{"$ne": true}, "occurredAt": bson.M{"$gte": start.UnixMilli()},
		"$or": bson.A{bson.M{"transferGroup": bson.M{"$exists": false}}, bson.M{"transferGroup": nil}, bson.M{"transferGroup": ""}}}
	if ws := r.URL.Query().Get("workspace"); ws == "personal" || ws == "business" {
		m["workspace"] = ws
	}
	pipe := mongo.Pipeline{
		{{Key: "$match", Value: m}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: bson.D{
				{Key: "month", Value: bson.D{{Key: "$dateToString", Value: bson.D{{Key: "format", Value: "%Y-%m"}, {Key: "date", Value: bson.D{{Key: "$toDate", Value: "$occurredAt"}}}, {Key: "timezone", Value: tzName}}}}},
				{Key: "type", Value: "$type"},
			}},
			{Key: "total", Value: bson.D{{Key: "$sum", Value: bson.D{{Key: "$cond", Value: bson.A{
				bson.D{{Key: "$eq", Value: bson.A{"$type", "expense"}}},
				bson.D{{Key: "$add", Value: bson.A{"$amount", bson.D{{Key: "$ifNull", Value: bson.A{"$fee", 0}}}}}},
				"$amount",
			}}}}}},
		}}},
	}
	var rows []struct {
		ID struct {
			Month string `bson:"month"`
			Type  string `bson:"type"`
		} `bson:"_id"`
		Total int64 `bson:"total"`
	}
	if err := h.run(r, pipe, &rows); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "report failed")
		return
	}
	type month struct {
		Month   string `json:"month"`
		Income  int64  `json:"income"`
		Expense int64  `json:"expense"`
		Net     int64  `json:"net"`
	}
	byMonth := map[string]*month{}
	for i := 0; i < months; i++ {
		k := start.AddDate(0, i, 0).Format("2006-01")
		byMonth[k] = &month{Month: k}
	}
	for _, row := range rows {
		if mm, ok := byMonth[row.ID.Month]; ok {
			switch row.ID.Type {
			case "income":
				mm.Income += row.Total
			case "expense":
				mm.Expense += row.Total
			}
		}
	}
	out := make([]month, 0, len(byMonth))
	for _, mm := range byMonth {
		mm.Net = mm.Income - mm.Expense
		out = append(out, *mm)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Month < out[j].Month })
	httpx.JSON(w, http.StatusOK, map[string]any{"months": out})
}

// csvSafe prevents spreadsheet formula injection from user-controlled text.
func csvSafe(s string) string {
	if s != "" && strings.ContainsRune("=+-@\t\r", rune(s[0])) {
		return "'" + s
	}
	return s
}

// Export streams the period's transactions as CSV.
func (h *Reports) Export(w http.ResponseWriter, r *http.Request) {
	cur, err := h.Store.Col("transactions").Find(r.Context(), h.match(r, false, false), options.Find().SetSort(bson.D{{Key: "occurredAt", Value: 1}}))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "export failed")
		return
	}
	defer cur.Close(r.Context())
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="birrpulse-transactions.csv"`)
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"date", "type", "channel", "category", "counterparty", "amount_etb", "fee_etb", "balance_after_etb", "reference", "source", "note"})
	loc := location()
	money := func(v any) string {
		n, ok := toInt(toJSONNumber(v))
		if !ok {
			return ""
		}
		return strconv.FormatFloat(float64(n)/100, 'f', 2, 64)
	}
	for cur.Next(r.Context()) {
		var d bson.M
		if err := cur.Decode(&d); err != nil {
			continue
		}
		at, _ := toInt(toJSONNumber(d["occurredAt"]))
		str := func(k string) string { s, _ := d[k].(string); return csvSafe(s) }
		_ = cw.Write([]string{
			time.UnixMilli(at).In(loc).Format("2006-01-02 15:04:05"), str("type"), str("channel"), str("categoryId"), str("counterparty"),
			money(d["amount"]), money(d["fee"]), money(d["balanceAfter"]), str("ref"), str("source"), str("note"),
		})
	}
	cw.Flush()
}

func toJSONNumber(v any) any {
	switch n := v.(type) {
	case int32:
		return int64(n)
	}
	return v
}
