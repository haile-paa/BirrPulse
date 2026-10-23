package handlers

import "testing"

func TestCleanEmail(t *testing.T) {
	good := map[string]string{" Abebe@Example.com ": "abebe@example.com", "a.b@mail.co.et": "a.b@mail.co.et"}
	for in, want := range good {
		if got, ok := cleanEmail(in); !ok || got != want {
			t.Errorf("cleanEmail(%q) = %q, %v", in, got, ok)
		}
	}
	for _, bad := range []string{"", "abebe", "abebe@", "@x.com", "a@b", "Abe <a@b.com>", "a b@c.com"} {
		if _, ok := cleanEmail(bad); ok {
			t.Errorf("cleanEmail(%q) should fail", bad)
		}
	}
}

func TestEmailCodeHashBinding(t *testing.T) {
	h := &Recovery{Secret: []byte("secret-secret-secret-secret-1234")}
	a := h.hash("reset:1", "a@b.com", "123456")
	if a == h.hash("reset:2", "a@b.com", "123456") || a == h.hash("reset:1", "c@d.com", "123456") || a == h.hash("reset:1", "a@b.com", "654321") {
		t.Fatal("hash must depend on key, email and code")
	}
}
