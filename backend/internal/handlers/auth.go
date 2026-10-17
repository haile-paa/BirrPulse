// Package handlers contains the HTTP handlers of the BirrPulse API.
package handlers

import (
	"context"
	"net/http"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"

	"birrpulse/internal/auth"
	"birrpulse/internal/db"
	"birrpulse/internal/httpx"
	"birrpulse/internal/phone"
)

type Auth struct {
	Store  *db.Store
	Tokens *auth.Manager
}

type userDoc struct {
	ID           primitive.ObjectID `bson:"_id,omitempty"`
	Name         string             `bson:"name"`
	Email        *string            `bson:"email,omitempty"`
	Phone        *string            `bson:"phone,omitempty"`
	PasswordHash string             `bson:"passwordHash"`
	CreatedAt    time.Time          `bson:"createdAt"`
}

type userOut struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email,omitempty"`
	Phone string `json:"phone,omitempty"`
}

type authOut struct {
	AccessToken  string  `json:"accessToken"`
	RefreshToken string  `json:"refreshToken"`
	User         userOut `json:"user"`
}

type credentials struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

// Compared against when the user does not exist, so login timing does not reveal which accounts exist.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("birrpulse-dummy"), 12)

func toOut(u userDoc) userOut {
	o := userOut{ID: u.ID.Hex(), Name: u.Name}
	if u.Email != nil {
		o.Email = *u.Email
	}
	if u.Phone != nil {
		o.Phone = *u.Phone
	}
	return o
}

func (c *credentials) normalize() (email, ph *string, errMsg string) {
	if e := strings.ToLower(strings.TrimSpace(c.Email)); e != "" {
		if !strings.Contains(e, "@") || len(e) > 254 {
			return nil, nil, "invalid email address"
		}
		email = &e
	}
	if raw := strings.TrimSpace(c.Phone); raw != "" {
		p, err := phone.Canonical(raw)
		if err != nil {
			return nil, nil, "invalid phone number"
		}
		ph = &p
	}
	if email == nil && ph == nil {
		return nil, nil, "email or phone is required"
	}
	return email, ph, ""
}

func (h *Auth) respond(ctx context.Context, w http.ResponseWriter, status int, u userDoc) {
	access, refresh, err := h.Tokens.Pair(ctx, u.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create session")
		return
	}
	httpx.JSON(w, status, authOut{AccessToken: access, RefreshToken: refresh, User: toOut(u)})
}

func (h *Auth) Register(w http.ResponseWriter, r *http.Request) {
	var in credentials
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if len(in.Name) < 2 || len(in.Name) > 80 {
		httpx.Error(w, http.StatusBadRequest, "name must be 2 to 80 characters")
		return
	}
	if len(in.Password) < 8 || len(in.Password) > 72 {
		httpx.Error(w, http.StatusBadRequest, "password must be 8 to 72 characters")
		return
	}
	email, ph, msg := in.normalize()
	if msg != "" {
		httpx.Error(w, http.StatusBadRequest, msg)
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), 12)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not create account")
		return
	}
	u := userDoc{ID: primitive.NewObjectID(), Name: in.Name, Email: email, Phone: ph, PasswordHash: string(hash), CreatedAt: time.Now()}
	if _, err := h.Store.Col(db.Users).InsertOne(r.Context(), u); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			httpx.Error(w, http.StatusConflict, "an account with this email or phone already exists")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "could not create account")
		return
	}
	h.respond(r.Context(), w, http.StatusCreated, u)
}

func (h *Auth) Login(w http.ResponseWriter, r *http.Request) {
	var in credentials
	if err := httpx.Decode(w, r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	email, ph, msg := in.normalize()
	if msg != "" {
		httpx.Error(w, http.StatusBadRequest, msg)
		return
	}
	filter := bson.M{}
	if email != nil {
		filter["email"] = *email
	} else {
		filter["phone"] = *ph
	}
	var u userDoc
	findErr := h.Store.Col(db.Users).FindOne(r.Context(), filter).Decode(&u)
	hash := []byte(u.PasswordHash)
	if findErr != nil {
		hash = dummyHash
	}
	if bcrypt.CompareHashAndPassword(hash, []byte(in.Password)) != nil || findErr != nil {
		httpx.Error(w, http.StatusUnauthorized, "wrong email/phone or password")
		return
	}
	h.respond(r.Context(), w, http.StatusOK, u)
}

func (h *Auth) Refresh(w http.ResponseWriter, r *http.Request) {
	var in struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := httpx.Decode(w, r, &in); err != nil || in.RefreshToken == "" {
		httpx.Error(w, http.StatusBadRequest, "refreshToken is required")
		return
	}
	access, refresh, err := h.Tokens.Rotate(r.Context(), in.RefreshToken)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"accessToken": access, "refreshToken": refresh})
}

func (h *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	var in struct {
		RefreshToken string `json:"refreshToken"`
	}
	_ = httpx.Decode(w, r, &in)
	if in.RefreshToken != "" {
		h.Tokens.Revoke(r.Context(), in.RefreshToken)
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *Auth) Me(w http.ResponseWriter, r *http.Request) {
	var u userDoc
	if err := h.Store.Col(db.Users).FindOne(r.Context(), bson.M{"_id": auth.UserID(r.Context())}).Decode(&u); err != nil {
		httpx.Error(w, http.StatusNotFound, "user not found")
		return
	}
	httpx.JSON(w, http.StatusOK, toOut(u))
}

// Export returns everything stored for the user (data portability).
func (h *Auth) Export(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserID(r.Context())
	out := bson.M{}
	for _, c := range db.SyncCollections {
		cur, err := h.Store.Col(c).Find(r.Context(), bson.M{"userId": uid})
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "export failed")
			return
		}
		var docs []bson.M
		if err := cur.All(r.Context(), &docs); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "export failed")
			return
		}
		for _, d := range docs {
			public(d)
		}
		out[c] = docs
	}
	w.Header().Set("Content-Disposition", `attachment; filename="birrpulse-export.json"`)
	httpx.JSON(w, http.StatusOK, out)
}

// DeleteAccount erases the user and all of their data.
func (h *Auth) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	uid := auth.UserID(r.Context())
	ctx := r.Context()
	cols := append(append([]string{}, db.SyncCollections...), db.RefreshTokens, db.Devices, db.Notifications)
	for _, c := range cols {
		if _, err := h.Store.Col(c).DeleteMany(ctx, bson.M{"userId": uid}); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "could not delete all data")
			return
		}
	}
	if _, err := h.Store.Col(db.Users).DeleteOne(ctx, bson.M{"_id": uid}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "could not delete account")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"deleted": true})
}
