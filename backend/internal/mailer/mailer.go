// Package mailer sends transactional email (sign-in codes).
package mailer

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/smtp"
	"strings"
	"time"
)

type Sender interface {
	Send(ctx context.Context, to, subject, text string) error
	// Real reports whether mail really leaves the server (false for the development log sender).
	Real() bool
}

// LogSender prints the message to the server log. For local development only.
type LogSender struct{ Log *slog.Logger }

func (l LogSender) Send(_ context.Context, to, subject, text string) error {
	l.Log.Warn("email not sent (log sender, development only)", "to", to, "subject", subject, "text", text)
	return nil
}
func (LogSender) Real() bool { return false }

// SMTP sends through any SMTP server (Gmail app password, Brevo, Mailgun, SES SMTP, your own). It upgrades to
// TLS with STARTTLS when the server offers it, and refuses to send credentials over an unencrypted connection.
type SMTP struct {
	Host, Port, User, Password, From string
	Timeout                          time.Duration
}

func (s *SMTP) Real() bool { return true }

func (s *SMTP) Send(ctx context.Context, to, subject, text string) error {
	if strings.ContainsAny(to+subject+s.From, "\r\n") {
		return errors.New("invalid header value")
	}
	addr := net.JoinHostPort(s.Host, s.Port)
	var auth smtp.Auth
	if s.User != "" {
		auth = smtp.PlainAuth("", s.User, s.Password, s.Host) // net/smtp only allows PLAIN over TLS or to localhost
	}
	msg := strings.Join([]string{
		"From: BirrPulse <" + s.From + ">",
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Date: " + time.Now().Format(time.RFC1123Z),
		"",
		text,
	}, "\r\n")
	done := make(chan error, 1)
	go func() { done <- smtp.SendMail(addr, auth, s.From, []string{to}, []byte(msg)) }()
	timeout := s.Timeout
	if timeout == 0 {
		timeout = 20 * time.Second
	}
	select {
	case err := <-done:
		return err
	case <-time.After(timeout):
		return fmt.Errorf("smtp timeout after %s", timeout)
	case <-ctx.Done():
		return ctx.Err()
	}
}
