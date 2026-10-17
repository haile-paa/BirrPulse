package handlers

import (
	"regexp"
	"testing"
)

func TestOTPHashIsBoundToEmailAndCode(t *testing.T) {
	o := &OTP{Secret: []byte("secret-secret-secret-secret-1234")}
	a := o.hash("a@example.com", "123456")
	if a != o.hash("a@example.com", "123456") {
		t.Fatal("hash must be deterministic")
	}
	if a == o.hash("a@example.com", "123457") || a == o.hash("b@example.com", "123456") {
		t.Fatal("hash must depend on both email and code")
	}
	other := &OTP{Secret: []byte("another-secret-another-secret-12")}
	if a == other.hash("a@example.com", "123456") {
		t.Fatal("hash must depend on the secret")
	}
}

func TestNewCodeIsSixDigits(t *testing.T) {
	re := regexp.MustCompile(`^[0-9]{6}$`)
	for i := 0; i < 200; i++ {
		c, err := newCode()
		if err != nil || !re.MatchString(c) {
			t.Fatalf("bad code %q (%v)", c, err)
		}
	}
}

func TestNormalizeEmail(t *testing.T) {
	good := map[string]string{"  Haile@Example.COM ": "haile@example.com", "a.b+c@mail.co.et": "a.b+c@mail.co.et"}
	for in, want := range good {
		if got, err := normalizeEmail(in); err != nil || got != want {
			t.Errorf("normalizeEmail(%q) = %q, %v", in, got, err)
		}
	}
	for _, bad := range []string{"", "nope", "a@b", "a@b.c\r\nBcc: x@y.z", "Name <a@b.co>", "a@b.co, c@d.co", "@b.co"} {
		if _, err := normalizeEmail(bad); err == nil {
			t.Errorf("normalizeEmail(%q) should fail", bad)
		}
	}
}
