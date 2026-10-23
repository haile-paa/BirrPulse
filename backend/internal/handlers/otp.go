package handlers

// DISABLED: email sign-in codes. BirrPulse no longer asks for an email: people sign in with a phone number and a code that
// arrives as an app notification (see phoneauth.go). This code is kept, commented out, so email verification can
// be switched back on later: remove the comment markers here, in cmd/server/main.go and in the mobile app.

/*
import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"birrpulse/internal/db"
	"birrpulse/internal/httpx"
	"birrpulse/internal/mailer"
)

// OTP implements passwordless email login with one-time codes.
type OTP struct {
	Store   *db.Store
	Auth    *Auth
	Mail    mailer.Sender
	Secret  []byte
	TTL     time.Duration
	Enabled bool // false when no real mail provider is configured in production
}

const (
	otpResendGap   = 60 * time.Second
	otpWindow      = 15 * time.Minute
	otpMaxPerWin   = 3
	otpMaxAttempts = 5
)

var errBadEmail = errors.New("enter a valid email address")

// normalizeEmail lower-cases and validates an address (no display names, no header injection).
func normalizeEmail(raw string) (string, error) {
	s := strings.ToLower(strings.TrimSpace(raw))
	if s == "" || len(s) > 254 || strings.ContainsAny(s, "\r\n<>,;\" ") {
		return "", errBadEmail
	}
	a, err := mail.ParseAddress(s)
	if err != nil || a.Address != s || !strings.Contains(s[strings.LastIndex(s, "@"):], ".") {
		return "", errBadEmail
	}
	return s, nil
}

func (o *OTP) hash(email, code string) string {
	m := hmac.New(sha256.New, o.Secret)
	m.Write([]byte(email + ":" + code))
	return hex.EncodeToString(m.Sum(nil))
}

func newCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

type otpDoc struct {
	Email       string    `bson:"email"`
	Hash        string    `bson:"hash"`
	ExpiresAt   time.Time `bson:"expiresAt"`
	Attempts    int       `bson:"attempts"`
	SentAt      time.Time `bson:"sentAt"`
	WindowStart time.Time `bson:"windowStart"`
	SendCount   int       `bson:"sendCount"`
}

// Request emails a 6 digit code. The response never reveals whether the address already has an account.
func (o *OTP) Request(w http.ResponseWriter, r *http.Request) {
	if !o.Enabled {
		httpx.Error(w, http.StatusServiceUnavailable, "email sign-in is not available right now")
		return
	}
	var in struct {
		Email string `json:"email"`
	}
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	em, err := normalizeEmail(in.Email)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx := r.Context()
	now := time.Now()
	col := o.Store.Col(db.OTPs)

	var cur otpDoc
	found := col.FindOne(ctx, bson.M{"email": em}).Decode(&cur) == nil
	windowStart, count := now, 0
	if found {
		if wait := otpResendGap - now.Sub(cur.SentAt); wait > 0 {
			secs := int(wait.Seconds()) + 1
			w.Header().Set("Retry-After", fmt.Sprint(secs))
			httpx.JSON(w, http.StatusTooManyRequests, map[string]any{"error": "please wait before requesting another code", "retryAfter": secs})
			return
		}
		if now.Sub(cur.WindowStart) < otpWindow {
			windowStart, count = cur.WindowStart, cur.SendCount
		}
		if count >= otpMaxPerWin {
			httpx.Error(w, http.StatusTooManyRequests, "too many codes requested, try again in a few minutes")
			return
		}
	}
	code, err := newCode()
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create a code")
		return
	}
	// Store first, then send: a failed send leaves a code nobody received, which simply expires.
	_, err = col.UpdateOne(ctx, bson.M{"email": em}, bson.M{"$set": bson.M{
		"hash": o.hash(em, code), "expiresAt": now.Add(o.TTL), "attempts": 0, "sentAt": now,
		"windowStart": windowStart, "sendCount": count + 1, "purgeAt": now.Add(24 * time.Hour),
	}}, options.Update().SetUpsert(true))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create a code")
		return
	}
	text := fmt.Sprintf("Your BirrPulse sign-in code is %s\n\nIt expires in %d minutes and works once.\nNever share this code with anyone. If you did not ask for it, you can ignore this email.\n",
		code, int(o.TTL.Minutes()))
	if err := o.Mail.Send(ctx, em, "Your BirrPulse sign-in code", text); err != nil {
		httpx.Error(w, http.StatusBadGateway, "could not send the email, try again")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"sent": true, "expiresIn": int(o.TTL.Seconds()), "resendIn": int(otpResendGap.Seconds())})
}

// Verify checks the code and signs the user in, creating the account on first use.
func (o *OTP) Verify(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email string `json:"email"`
		Code  string `json:"code"`
		Name  string `json:"name"`
	}
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	em, err := normalizeEmail(in.Email)
	code := strings.TrimSpace(in.Code)
	if err != nil || len(code) != 6 {
		httpx.Error(w, http.StatusBadRequest, "enter your email and the 6 digit code")
		return
	}
	ctx := r.Context()
	col := o.Store.Col(db.OTPs)
	var doc otpDoc
	if col.FindOne(ctx, bson.M{"email": em}).Decode(&doc) != nil || time.Now().After(doc.ExpiresAt) {
		httpx.Error(w, http.StatusUnauthorized, "the code is wrong or has expired")
		return
	}
	if doc.Attempts >= otpMaxAttempts {
		_, _ = col.DeleteOne(ctx, bson.M{"email": em})
		httpx.Error(w, http.StatusTooManyRequests, "too many wrong codes, request a new one")
		return
	}
	if subtle.ConstantTimeCompare([]byte(o.hash(em, code)), []byte(doc.Hash)) != 1 {
		_, _ = col.UpdateOne(ctx, bson.M{"email": em}, bson.M{"$inc": bson.M{"attempts": 1}})
		httpx.Error(w, http.StatusUnauthorized, "the code is wrong or has expired")
		return
	}
	// A code works exactly once.
	if res, err := col.DeleteOne(ctx, bson.M{"email": em, "hash": doc.Hash}); err != nil || res.DeletedCount == 0 {
		httpx.Error(w, http.StatusUnauthorized, "the code is wrong or has expired")
		return
	}

	var u userDoc
	isNew := false
	if err := o.Store.Col(db.Users).FindOne(ctx, bson.M{"email": em}).Decode(&u); err != nil {
		name := strings.TrimSpace(in.Name)
		if len(name) < 2 || len(name) > 80 {
			name = strings.Split(em, "@")[0]
		}
		e := em
		u = userDoc{ID: primitive.NewObjectID(), Name: name, Email: &e, CreatedAt: time.Now()} // no password: email-code login only
		if _, err := o.Store.Col(db.Users).InsertOne(ctx, u); err != nil && !mongo.IsDuplicateKeyError(err) {
			httpx.Error(w, http.StatusInternalServerError, "could not create the account")
			return
		}
		isNew = true
	}
	access, refresh, err := o.Auth.Tokens.Pair(ctx, u.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create session")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"accessToken": access, "refreshToken": refresh, "user": toOut(u), "isNew": isNew})
}
*/
