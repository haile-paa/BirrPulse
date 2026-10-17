// Package phone normalises phone numbers to E.164 so the same person always maps to the same account.
package phone

import (
	"errors"
	"regexp"
	"strings"
)

var (
	etLocal = regexp.MustCompile(`^0([79][0-9]{8})$`)    // 09xxxxxxxx / 07xxxxxxxx
	e164    = regexp.MustCompile(`^\+[1-9][0-9]{7,14}$`) // any international number
	etFull  = regexp.MustCompile(`^\+251[79][0-9]{8}$`)  // Ethiopian mobile
	cleaner = strings.NewReplacer(" ", "", "-", "", "(", "", ")", "", ".", "")
)

var ErrInvalid = errors.New("invalid phone number")

// Canonical turns "0911 22 33 44", "251911223344" or "+251911223344" into "+251911223344".
func Canonical(raw string) (string, error) {
	s := cleaner.Replace(strings.TrimSpace(raw))
	switch {
	case strings.HasPrefix(s, "00"):
		s = "+" + s[2:]
	case strings.HasPrefix(s, "251") && len(s) == 12:
		s = "+" + s
	}
	if m := etLocal.FindStringSubmatch(s); m != nil {
		s = "+251" + m[1]
	}
	if strings.HasPrefix(s, "+251") {
		if !etFull.MatchString(s) {
			return "", ErrInvalid
		}
		return s, nil
	}
	if !e164.MatchString(s) {
		return "", ErrInvalid
	}
	return s, nil
}
