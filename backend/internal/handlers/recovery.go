package handlers

import (
	"context"
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
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"

	"birrpulse/internal/auth"
	"birrpulse/internal/db"
	"birrpulse/internal/httpx"
	"birrpulse/internal/mailer"
	"birrpulse/internal/phone"
)

// Recovery handles "forgot password". Sign-up asks for no email, so an account can only be recovered by email after
// the person has linked a recovery email while signed in (Profile > Recovery email, confirmed with a code).
// A reset code is only ever sent to the email linked to the account whose phone number was typed.
type Recovery struct {
	Store  *db.Store
	Tokens *auth.Manager
	Mail   mailer.Sender
	Secret []byte
	TTL    time.Duration
	// Enabled is false in production when no SMTP server is configured.
	Enabled bool
}

const (
	rcResendGap   = 60 * time.Second
	rcMaxAttempts = 5
)

var (
	errCodeTooSoon = errors.New("please wait before asking for another code")
	errBadCode     = errors.New("the code is wrong or has expired")
)

type emailCodeDoc struct {
	Key       string    `bson:"key"`
	Email     string    `bson:"email"`
	Hash      string    `bson:"hash"`
	ExpiresAt time.Time `bson:"expiresAt"`
	Attempts  int       `bson:"attempts"`
	SentAt    time.Time `bson:"sentAt"`
}

func (h *Recovery) hash(key, email, code string) string {
	m := hmac.New(sha256.New, h.Secret)
	m.Write([]byte("email:" + key + ":" + email + ":" + code))
	return hex.EncodeToString(m.Sum(nil))
}

func newEmailCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func cleanEmail(s string) (string, bool) {
	e := strings.ToLower(strings.TrimSpace(s))
	if len(e) > 254 {
		return "", false
	}
	a, err := mail.ParseAddress(e)
	if err != nil || a.Address != e || !strings.Contains(e[strings.LastIndex(e, "@"):], ".") {
		return "", false
	}
	return e, true
}

// issue stores a fresh code for key and returns it. A new code replaces the previous one.
func (h *Recovery) issue(ctx context.Context, key, email string) (string, error) {
	now := time.Now()
	col := h.Store.Col(db.EmailCodes)
	var cur emailCodeDoc
	if col.FindOne(ctx, bson.M{"key": key}).Decode(&cur) == nil && now.Sub(cur.SentAt) < rcResendGap {
		return "", errCodeTooSoon
	}
	code, err := newEmailCode()
	if err != nil {
		return "", err
	}
	_, err = col.UpdateOne(ctx, bson.M{"key": key}, bson.M{"$set": bson.M{
		"email": email, "hash": h.hash(key, email, code), "expiresAt": now.Add(h.TTL), "attempts": 0, "sentAt": now, "purgeAt": now.Add(24 * time.Hour),
	}}, options.Update().SetUpsert(true))
	return code, err
}

// check consumes the code for key. wantEmail may be empty (then the stored email is used and returned).
func (h *Recovery) check(ctx context.Context, key, wantEmail, code string) (string, error) {
	col := h.Store.Col(db.EmailCodes)
	var doc emailCodeDoc
	if col.FindOne(ctx, bson.M{"key": key}).Decode(&doc) != nil || time.Now().After(doc.ExpiresAt) || (wantEmail != "" && doc.Email != wantEmail) {
		return "", errBadCode
	}
	if doc.Attempts >= rcMaxAttempts {
		_, _ = col.DeleteOne(ctx, bson.M{"key": key})
		return "", errors.New("too many wrong codes, ask for a new one")
	}
	if subtle.ConstantTimeCompare([]byte(h.hash(key, doc.Email, strings.TrimSpace(code))), []byte(doc.Hash)) != 1 {
		_, _ = col.UpdateOne(ctx, bson.M{"key": key}, bson.M{"$inc": bson.M{"attempts": 1}})
		return "", errBadCode
	}
	if res, err := col.DeleteOne(ctx, bson.M{"key": key, "hash": doc.Hash}); err != nil || res.DeletedCount == 0 {
		return "", errBadCode // a code works exactly once
	}
	return doc.Email, nil
}

func (h *Recovery) send(ctx context.Context, to, subject, intro, code string) error {
	text := fmt.Sprintf("%s\n\nYour BirrPulse code: %s\n\nIt works once and expires in %d minutes. If you did not ask for it, ignore this email and do not share the code.\n",
		intro, code, int(h.TTL.Minutes()))
	return h.Mail.Send(ctx, to, subject, text)
}

func (h *Recovery) userByPhone(ctx context.Context, raw string) (userDoc, bool) {
	ph, err := phone.Canonical(raw)
	if err != nil {
		return userDoc{}, false
	}
	var u userDoc
	if h.Store.Col(db.Users).FindOne(ctx, bson.M{"phone": ph}).Decode(&u) != nil {
		return userDoc{}, false
	}
	return u, true
}

// ForgotRequest emails a reset code. The answer is always the same, so nobody can use it to find out which phone
// numbers or emails have accounts.
func (h *Recovery) ForgotRequest(w http.ResponseWriter, r *http.Request) {
	if !h.Enabled {
		httpx.Error(w, http.StatusServiceUnavailable, "password reset is not available right now")
		return
	}
	var in struct{ Phone, Email string }
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	email, ok := cleanEmail(in.Email)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "enter a valid email address")
		return
	}
	if _, err := phone.Canonical(in.Phone); err != nil {
		httpx.Error(w, http.StatusBadRequest, "enter a valid phone number")
		return
	}
	reply := map[string]any{"ok": true, "resendIn": int(rcResendGap.Seconds())}
	ctx := r.Context()
	u, found := h.userByPhone(ctx, in.Phone)
	if !found || u.Email == nil || *u.Email != email {
		httpx.JSON(w, http.StatusOK, reply)
		return
	}
	code, err := h.issue(ctx, "reset:"+u.ID.Hex(), email)
	if errors.Is(err, errCodeTooSoon) {
		httpx.JSON(w, http.StatusOK, reply)
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create a code")
		return
	}
	if err := h.send(ctx, email, "Reset your BirrPulse password", "Use this code to choose a new password.", code); err != nil {
		httpx.Error(w, http.StatusBadGateway, "could not send the email, try again")
		return
	}
	httpx.JSON(w, http.StatusOK, reply)
}

// ForgotConfirm checks the emailed code and sets the new password. All saved sessions are closed.
func (h *Recovery) ForgotConfirm(w http.ResponseWriter, r *http.Request) {
	var in struct{ Phone, Email, Code, Password string }
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	email, ok := cleanEmail(in.Email)
	if !ok || len(strings.TrimSpace(in.Code)) != 6 {
		httpx.Error(w, http.StatusBadRequest, "enter your email and the 6 digit code")
		return
	}
	if len(in.Password) < 8 || len(in.Password) > 72 {
		httpx.Error(w, http.StatusBadRequest, "password must be 8 to 72 characters")
		return
	}
	ctx := r.Context()
	u, found := h.userByPhone(ctx, in.Phone)
	if !found || u.Email == nil || *u.Email != email {
		httpx.Error(w, http.StatusUnauthorized, errBadCode.Error())
		return
	}
	if _, err := h.check(ctx, "reset:"+u.ID.Hex(), email, in.Code); err != nil {
		httpx.Error(w, http.StatusUnauthorized, err.Error())
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), 12)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save the password")
		return
	}
	if _, err := h.Store.Col(db.Users).UpdateOne(ctx, bson.M{"_id": u.ID}, bson.M{"$set": bson.M{"passwordHash": string(hash)}}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not save the password")
		return
	}
	h.Tokens.RevokeAll(ctx, u.ID)
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// LinkEmailRequest (signed in) emails a code to confirm a recovery email address.
func (h *Recovery) LinkEmailRequest(w http.ResponseWriter, r *http.Request) {
	if !h.Enabled {
		httpx.Error(w, http.StatusServiceUnavailable, "email is not available right now")
		return
	}
	var in struct{ Email string }
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	email, ok := cleanEmail(in.Email)
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "enter a valid email address")
		return
	}
	ctx := r.Context()
	uid := auth.UserID(ctx)
	if n, _ := h.Store.Col(db.Users).CountDocuments(ctx, bson.M{"email": email, "_id": bson.M{"$ne": uid}}); n > 0 {
		httpx.Error(w, http.StatusConflict, "this email is already used by another account")
		return
	}
	code, err := h.issue(ctx, "link:"+uid.Hex(), email)
	if errors.Is(err, errCodeTooSoon) {
		httpx.Error(w, http.StatusTooManyRequests, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create a code")
		return
	}
	if err := h.send(ctx, email, "Confirm your BirrPulse recovery email", "Use this code to confirm this email for password recovery.", code); err != nil {
		httpx.Error(w, http.StatusBadGateway, "could not send the email, try again")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true, "resendIn": int(rcResendGap.Seconds())})
}

// LinkEmailVerify (signed in) saves the recovery email once the code is right.
func (h *Recovery) LinkEmailVerify(w http.ResponseWriter, r *http.Request) {
	var in struct{ Code string }
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	ctx := r.Context()
	uid := auth.UserID(ctx)
	email, err := h.check(ctx, "link:"+uid.Hex(), "", in.Code)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, err.Error())
		return
	}
	if _, err := h.Store.Col(db.Users).UpdateOne(ctx, bson.M{"_id": uid}, bson.M{"$set": bson.M{"email": email}}); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			httpx.Error(w, http.StatusConflict, "this email is already used by another account")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "could not save the email")
		return
	}
	var u userDoc
	_ = h.Store.Col(db.Users).FindOne(ctx, bson.M{"_id": uid}).Decode(&u)
	httpx.JSON(w, http.StatusOK, toOut(u))
}
