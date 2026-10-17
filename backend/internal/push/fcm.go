package push

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// FCM sends notifications through the Firebase Cloud Messaging HTTP v1 API using a service account.
// It needs no Firebase SDK: it signs a JWT, exchanges it for an OAuth token and caches that token.
type FCM struct {
	ProjectID string
	APIBase   string // https://fcm.googleapis.com
	TokenURI  string

	clientEmail string
	key         any
	hc          *http.Client

	mu     sync.Mutex
	access string
	expiry time.Time
}

type serviceAccount struct {
	ProjectID   string `json:"project_id"`
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

// NewFCM parses a Firebase service-account JSON file (Project settings > Service accounts > Generate new private key).
func NewFCM(credsJSON []byte) (*FCM, error) {
	var sa serviceAccount
	if err := json.Unmarshal(credsJSON, &sa); err != nil {
		return nil, fmt.Errorf("invalid service account JSON: %w", err)
	}
	if sa.ProjectID == "" || sa.ClientEmail == "" || sa.PrivateKey == "" {
		return nil, errors.New("service account JSON must contain project_id, client_email and private_key")
	}
	key, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(sa.PrivateKey))
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}
	if sa.TokenURI == "" {
		sa.TokenURI = "https://oauth2.googleapis.com/token"
	}
	return &FCM{ProjectID: sa.ProjectID, APIBase: "https://fcm.googleapis.com", TokenURI: sa.TokenURI,
		clientEmail: sa.ClientEmail, key: key, hc: &http.Client{Timeout: 15 * time.Second}}, nil
}

func (f *FCM) accessToken(ctx context.Context) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.access != "" && time.Until(f.expiry) > time.Minute {
		return f.access, nil
	}
	now := time.Now()
	assertion, err := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss": f.clientEmail, "scope": "https://www.googleapis.com/auth/firebase.messaging",
		"aud": f.TokenURI, "iat": now.Unix(), "exp": now.Add(55 * time.Minute).Unix(),
	}).SignedString(f.key)
	if err != nil {
		return "", err
	}
	form := url.Values{"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"}, "assertion": {assertion}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, f.TokenURI, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := f.hc.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<16))
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("google token endpoint returned %d", res.StatusCode)
	}
	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || out.AccessToken == "" {
		return "", errors.New("unexpected token response from Google")
	}
	f.access = out.AccessToken
	f.expiry = now.Add(time.Duration(out.ExpiresIn) * time.Second)
	return f.access, nil
}

// Send delivers the notification to each token and reports tokens FCM says are unregistered.
func (f *FCM) Send(ctx context.Context, tokens []string, title, body string, data map[string]string) ([]string, error) {
	access, err := f.accessToken(ctx)
	if err != nil {
		return nil, err
	}
	var invalid []string
	var firstErr error
	endpoint := fmt.Sprintf("%s/v1/projects/%s/messages:send", f.APIBase, f.ProjectID)
	for _, tok := range tokens {
		msg := map[string]any{"message": map[string]any{
			"token":        tok,
			"notification": map[string]string{"title": title, "body": body},
			"data":         data,
			"android":      map[string]any{"priority": "HIGH", "notification": map[string]string{"channel_id": "default"}},
		}}
		buf, _ := json.Marshal(msg)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(buf))
		if err != nil {
			return invalid, err
		}
		req.Header.Set("Authorization", "Bearer "+access)
		req.Header.Set("Content-Type", "application/json")
		res, err := f.hc.Do(req)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		raw, _ := io.ReadAll(io.LimitReader(res.Body, 1<<16))
		res.Body.Close()
		if res.StatusCode/100 == 2 {
			continue
		}
		if res.StatusCode == http.StatusNotFound || bytes.Contains(raw, []byte("UNREGISTERED")) {
			invalid = append(invalid, tok)
			continue
		}
		if firstErr == nil {
			firstErr = fmt.Errorf("fcm returned %d", res.StatusCode)
		}
	}
	return invalid, firstErr
}
