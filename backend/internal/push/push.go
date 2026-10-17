// Package push delivers push notifications to user devices.
package push

import (
	"context"
	"log/slog"
)

// Sender delivers one notification to many device tokens. It returns the tokens the push service
// reported as no longer valid so the caller can delete them.
type Sender interface {
	Send(ctx context.Context, tokens []string, title, body string, data map[string]string) (invalid []string, err error)
}

// LogSender only logs. It is used when no Firebase credentials are configured.
type LogSender struct{ Log *slog.Logger }

func (l LogSender) Send(_ context.Context, tokens []string, title, body string, _ map[string]string) ([]string, error) {
	l.Log.Info("push not delivered (no FCM credentials configured)", "devices", len(tokens), "title", title, "body", body)
	return nil, nil
}
