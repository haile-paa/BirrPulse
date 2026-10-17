package handlers

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

var uid = primitive.NewObjectID()

func TestNormalizeAcceptsValidTransaction(t *testing.T) {
	doc, err := normalize("transactions", map[string]any{
		"id": "t1", "accountId": "a1", "type": "income", "amount": float64(2000000), "fee": float64(0), "occurredAt": float64(1760000000000),
		"categoryId": "salary", "evil": "dropped", "userId": "attacker",
	}, uid, 1760000000000)
	if err != nil {
		t.Fatal(err)
	}
	if doc["userId"] != uid {
		t.Fatal("userId must always come from the token, never from the body")
	}
	if _, ok := doc["evil"]; ok {
		t.Fatal("unknown fields must be dropped")
	}
	if doc["amount"].(int64) != 2000000 {
		t.Fatal("amount must be stored as an integer")
	}
}

func TestNormalizeRejectsBadInput(t *testing.T) {
	cases := map[string]map[string]any{
		"fractional money": {"id": "t", "accountId": "a", "type": "income", "amount": 10.5, "occurredAt": float64(1), "categoryId": "x"},
		"negative amount":  {"id": "t", "accountId": "a", "type": "income", "amount": float64(-5), "occurredAt": float64(1), "categoryId": "x"},
		"bad type":         {"id": "t", "accountId": "a", "type": "hack", "amount": float64(5), "occurredAt": float64(1), "categoryId": "x"},
		"missing id":       {"accountId": "a", "type": "income", "amount": float64(5), "occurredAt": float64(1), "categoryId": "x"},
		"missing required": {"id": "t", "type": "income", "amount": float64(5), "occurredAt": float64(1), "categoryId": "x"},
	}
	for name, in := range cases {
		if _, err := normalize("transactions", in, uid, 1000); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestFutureUpdatedAtIsClamped(t *testing.T) {
	now := int64(1_000_000)
	doc, err := normalize("goals", map[string]any{"id": "g", "name": "Phone", "target": float64(100), "updatedAt": float64(now + 10*60*1000)}, uid, now)
	if err != nil {
		t.Fatal(err)
	}
	if doc["updatedAt"].(int64) != now {
		t.Fatal("updatedAt more than 5 minutes ahead must be clamped to server time")
	}
}

func TestDebtRepaymentsValidated(t *testing.T) {
	ok := map[string]any{"id": "d", "direction": "lent", "person": "A", "principal": float64(1000),
		"repayments": []any{map[string]any{"id": "r1", "amount": float64(100), "at": float64(5)}}}
	if _, err := normalize("debts", ok, uid, 10); err != nil {
		t.Fatal(err)
	}
	ok["repayments"] = []any{map[string]any{"id": "r1", "amount": "x", "at": float64(5)}}
	if _, err := normalize("debts", ok, uid, 10); err == nil {
		t.Fatal("non-numeric repayment must be rejected")
	}
}

func TestMaskDigitsKeepsAmounts(t *testing.T) {
	got := maskDigits("credited with ETB 5,000.00 to 1000123456789")
	want := "credited with ETB 5,000.00 to 10001********"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestCSVSafe(t *testing.T) {
	if csvSafe("=HYPERLINK(1)") != "'=HYPERLINK(1)" || csvSafe("Tomoca") != "Tomoca" {
		t.Fatal("formula-looking cells must be neutralised")
	}
}
