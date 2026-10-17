package push

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFCMSend(t *testing.T) {
	priv, _ := rsa.GenerateKey(rand.Reader, 2048)
	pemKey := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(priv)})

	tokenCalls, sent := 0, []string{}
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		tokenCalls++
		_ = r.ParseForm()
		if r.Form.Get("grant_type") != "urn:ietf:params:oauth:grant-type:jwt-bearer" || r.Form.Get("assertion") == "" {
			w.WriteHeader(400)
			return
		}
		_, _ = w.Write([]byte(`{"access_token":"ya29.test","expires_in":3600}`))
	})
	mux.HandleFunc("/v1/projects/proj/messages:send", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer ya29.test" {
			w.WriteHeader(401)
			return
		}
		var in struct {
			Message struct {
				Token string `json:"token"`
			} `json:"message"`
		}
		_ = json.NewDecoder(r.Body).Decode(&in)
		if in.Message.Token == "dead" {
			w.WriteHeader(404)
			_, _ = w.Write([]byte(`{"error":{"details":[{"errorCode":"UNREGISTERED"}]}}`))
			return
		}
		sent = append(sent, in.Message.Token)
		_, _ = w.Write([]byte(`{"name":"ok"}`))
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	creds, _ := json.Marshal(map[string]string{"project_id": "proj", "client_email": "svc@proj.iam", "private_key": string(pemKey), "token_uri": srv.URL + "/token"})
	f, err := NewFCM(creds)
	if err != nil {
		t.Fatal(err)
	}
	f.APIBase = srv.URL
	invalid, err := f.Send(context.Background(), []string{"good", "dead"}, "Bill due", "ETB 100", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(sent) != 1 || sent[0] != "good" || len(invalid) != 1 || invalid[0] != "dead" {
		t.Fatalf("sent=%v invalid=%v", sent, invalid)
	}
	_, _ = f.Send(context.Background(), []string{"good"}, "x", "y", nil)
	if tokenCalls != 1 {
		t.Fatalf("access token should be cached, got %d token calls", tokenCalls)
	}
}
