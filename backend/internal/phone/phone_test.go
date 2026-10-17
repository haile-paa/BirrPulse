package phone

import "testing"

func TestCanonical(t *testing.T) {
	ok := map[string]string{
		"0911223344":     "+251911223344",
		"0911 22 33 44":  "+251911223344",
		"251911223344":   "+251911223344",
		"+251911223344":  "+251911223344",
		"00251711223344": "+251711223344",
		"+14155552671":   "+14155552671",
		"(091) 122-3344": "+251911223344",
	}
	for in, want := range ok {
		got, err := Canonical(in)
		if err != nil || got != want {
			t.Errorf("Canonical(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, bad := range []string{"", "abc", "0811223344", "+25191122", "12345", "+2519112233445"} {
		if _, err := Canonical(bad); err == nil {
			t.Errorf("Canonical(%q) should fail", bad)
		}
	}
}
