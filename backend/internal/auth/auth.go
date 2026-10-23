// Package auth issues and verifies access tokens (JWT) and rotating refresh tokens.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"birrpulse/internal/db"
	"birrpulse/internal/httpx"
)

type Manager struct {
	Secret     []byte
	AccessTTL  time.Duration
	RefreshTTL time.Duration
	Store      *db.Store
}

func (m *Manager) NewAccess(userID primitive.ObjectID) (string, error) {
	now := time.Now()
	claims := jwt.RegisteredClaims{Subject: userID.Hex(), IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(m.AccessTTL))}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.Secret)
}

func (m *Manager) ParseAccess(tok string) (primitive.ObjectID, error) {
	var claims jwt.RegisteredClaims
	_, err := jwt.ParseWithClaims(tok, &claims, func(t *jwt.Token) (any, error) { return m.Secret, nil },
		jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
	if err != nil {
		return primitive.NilObjectID, err
	}
	return primitive.ObjectIDFromHex(claims.Subject)
}

func hashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}

// IssueRefresh stores only a SHA-256 hash of the token, never the token itself.
func (m *Manager) IssueRefresh(ctx context.Context, userID primitive.ObjectID) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	raw := base64.RawURLEncoding.EncodeToString(b)
	_, err := m.Store.Col(db.RefreshTokens).InsertOne(ctx, bson.M{
		"hash": hashToken(raw), "userId": userID, "createdAt": time.Now(), "expiresAt": time.Now().Add(m.RefreshTTL),
	})
	return raw, err
}

var ErrInvalidRefresh = errors.New("invalid or expired refresh token")

// Rotate consumes a refresh token and returns a fresh access + refresh pair.
func (m *Manager) Rotate(ctx context.Context, raw string) (string, string, error) {
	var doc struct {
		UserID    primitive.ObjectID `bson:"userId"`
		ExpiresAt time.Time          `bson:"expiresAt"`
	}
	err := m.Store.Col(db.RefreshTokens).FindOneAndDelete(ctx, bson.M{"hash": hashToken(raw)}).Decode(&doc)
	if err != nil || time.Now().After(doc.ExpiresAt) {
		return "", "", ErrInvalidRefresh
	}
	return m.Pair(ctx, doc.UserID)
}

// Renew keeps the same refresh token but pushes its expiry to now + RefreshTTL and returns a fresh access token.
// The session therefore lasts RefreshTTL (one month) after the last use, and it survives until the user logs out.
// Unlike Rotate it cannot strand a phone that was closed before it stored a new token.
func (m *Manager) Renew(ctx context.Context, raw string) (string, error) {
	var doc struct {
		UserID    primitive.ObjectID `bson:"userId"`
		ExpiresAt time.Time          `bson:"expiresAt"`
	}
	err := m.Store.Col(db.RefreshTokens).FindOneAndUpdate(ctx,
		bson.M{"hash": hashToken(raw), "expiresAt": bson.M{"$gt": time.Now()}},
		bson.M{"$set": bson.M{"expiresAt": time.Now().Add(m.RefreshTTL)}}).Decode(&doc)
	if err != nil {
		return "", ErrInvalidRefresh
	}
	return m.NewAccess(doc.UserID)
}

func (m *Manager) Pair(ctx context.Context, userID primitive.ObjectID) (string, string, error) {
	a, err := m.NewAccess(userID)
	if err != nil {
		return "", "", err
	}
	r, err := m.IssueRefresh(ctx, userID)
	return a, r, err
}

// RevokeAll signs the user out everywhere (used after a password reset).
func (m *Manager) RevokeAll(ctx context.Context, userID primitive.ObjectID) {
	_, _ = m.Store.Col(db.RefreshTokens).DeleteMany(ctx, bson.M{"userId": userID})
}

func (m *Manager) Revoke(ctx context.Context, raw string) {
	_, _ = m.Store.Col(db.RefreshTokens).DeleteOne(ctx, bson.M{"hash": hashToken(raw)})
}

type ctxKey struct{}

// UserID returns the authenticated user's id; only valid behind Require.
func UserID(ctx context.Context) primitive.ObjectID {
	id, _ := ctx.Value(ctxKey{}).(primitive.ObjectID)
	return id
}

// Require rejects requests without a valid Bearer access token.
func (m *Manager) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			httpx.Error(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		id, err := m.ParseAccess(strings.TrimPrefix(h, "Bearer "))
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, id)))
	})
}
