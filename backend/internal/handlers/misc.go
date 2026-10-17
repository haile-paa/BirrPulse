package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"

	"birrpulse/internal/auth"
	"birrpulse/internal/db"
	"birrpulse/internal/httpx"
)

type Misc struct{ Store *db.Store }

// Health is used by load balancers and docker healthchecks.
func (h *Misc) Health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	if err := h.Store.Ping(ctx); err != nil {
		httpx.Error(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// RegisterDevice stores a push token (FCM) for the signed-in user.
func (h *Misc) RegisterDevice(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Token    string `json:"token"`
		Platform string `json:"platform"`
	}
	if err := httpx.Decode(w, r, &in); err != nil || len(in.Token) < 10 || len(in.Token) > 4096 {
		httpx.Error(w, http.StatusBadRequest, "a valid token is required")
		return
	}
	if in.Platform != "android" && in.Platform != "ios" {
		in.Platform = "android"
	}
	_, err := h.Store.Col(db.Devices).UpdateOne(r.Context(),
		bson.M{"userId": auth.UserID(r.Context()), "token": in.Token},
		bson.M{"$set": bson.M{"platform": in.Platform, "lastSeen": time.Now()}}, options.Update().SetUpsert(true))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save device")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Misc) RemoveDevice(w http.ResponseWriter, r *http.Request) {
	_, _ = h.Store.Col(db.Devices).DeleteOne(r.Context(), bson.M{"userId": auth.UserID(r.Context()), "token": r.PathValue("token")})
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// SubmitSample lets a user (with consent) send an unparsed bank SMS so the template can be added.
// Phone numbers and long digit sequences are masked before storing.
func (h *Misc) SubmitSample(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Sender string `json:"sender"`
		Body   string `json:"body"`
	}
	if err := httpx.Decode(w, r, &in); err != nil || in.Body == "" || len(in.Body) > 1000 {
		httpx.Error(w, http.StatusBadRequest, "body is required (max 1000 characters)")
		return
	}
	_, err := h.Store.Col("sms_samples").InsertOne(r.Context(), bson.M{
		"userId": auth.UserID(r.Context()), "sender": strings.TrimSpace(in.Sender), "body": maskDigits(in.Body), "at": time.Now(),
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save sample")
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]bool{"ok": true})
}

// maskDigits keeps amounts (with separators or decimals) readable but masks long digit runs such as phone and account numbers.
func maskDigits(s string) string {
	var b strings.Builder
	run := 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			run++
			if run > 5 {
				b.WriteRune('*')
				continue
			}
		} else {
			run = 0
		}
		b.WriteRune(c)
	}
	return b.String()
}
