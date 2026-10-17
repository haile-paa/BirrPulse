package handlers

import "testing"

func okBank() Bank {
	return Bank{Code: "CBE", Name: "Commercial Bank of Ethiopia", Short: "CBE", Color: "#7B2D8E", Senders: []string{"CBE"}, BodyHints: []string{"banking with cbe"},
		Templates: []Template{{ID: "debit-1", Direction: "debit", Flags: "i",
			Pattern: `debited with ETB\s*(?<amount>[\d,]+\.\d{2}).*?balance is ETB\s*(?<balance>[\d,]+\.\d{2})`}}}
}

func TestValidateBankAcceptsGoodTemplate(t *testing.T) {
	b := okBank()
	if err := validateBank(&b); err != nil {
		t.Fatal(err)
	}
}

func TestValidateBankRejectsUnsafeOrBroken(t *testing.T) {
	cases := map[string]func(*Bank){
		"no amount group":  func(b *Bank) { b.Templates[0].Pattern = `debited (?<balance>\d+)` },
		"unknown group":    func(b *Bank) { b.Templates[0].Pattern = `(?<amount>\d+)(?<evil>x)` },
		"lookahead":        func(b *Bank) { b.Templates[0].Pattern = `(?<amount>\d+)(?=x)` },
		"inline flag":      func(b *Bank) { b.Templates[0].Pattern = `(?i)(?<amount>\d+)` },
		"posix class":      func(b *Bank) { b.Templates[0].Pattern = `(?<amount>[[:digit:]]+)` },
		"does not compile": func(b *Bank) { b.Templates[0].Pattern = `(?<amount>\d+` },
		"too long":         func(b *Bank) { b.Templates[0].Pattern = "(?<amount>" + string(make([]byte, 700)) + ")" },
		"bad direction":    func(b *Bank) { b.Templates[0].Direction = "sideways" },
		"bad color":        func(b *Bank) { b.Color = "red" },
		"bad code":         func(b *Bank) { b.Code = "x" },
		"duplicate ids":    func(b *Bank) { b.Templates = append(b.Templates, b.Templates[0]) },
	}
	for name, mutate := range cases {
		b := okBank()
		mutate(&b)
		if err := validateBank(&b); err == nil {
			t.Errorf("%s: expected a validation error", name)
		}
	}
}

func TestVersionChangesWithContent(t *testing.T) {
	a := []Bank{{Code: "CBE", Version: 1, UpdatedAt: 10}}
	b := []Bank{{Code: "CBE", Version: 2, UpdatedAt: 20}}
	if version(a) == version(b) || version(a) != version([]Bank{{Code: "CBE", Version: 1, UpdatedAt: 10}}) {
		t.Fatal("version must be stable for equal content and differ when content changes")
	}
}
