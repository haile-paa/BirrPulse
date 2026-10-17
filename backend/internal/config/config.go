// Package config loads runtime configuration from environment variables.
package config

import (
	"errors"
	"os"
	"strings"
	"time"
)

type Config struct {
	Env         string
	Port        string
	MongoURI    string
	MongoDB     string
	JWTSecret   string
	AccessTTL   time.Duration
	RefreshTTL  time.Duration
	CORSOrigins []string

	OTPSecret          string
	OTPTTL             time.Duration
	SMTPHost           string // empty = log codes to the console (development only)
	SMTPPort           string
	SMTPUser           string
	SMTPPassword       string
	SMTPFrom           string
	FCMCredentialsFile string
	FCMCredentialsJSON string
	AdminToken         string
}

func get(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func dur(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}

func Load() (Config, error) {
	loadDotEnv(".env") // optional local file; real environment variables take priority
	c := Config{
		Env:        get("APP_ENV", "development"),
		Port:       get("PORT", "8080"),
		MongoURI:   get("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:    get("MONGO_DB", "birrpulse"),
		JWTSecret:  os.Getenv("JWT_SECRET"),
		AccessTTL:  dur("ACCESS_TTL", 15*time.Minute),
		RefreshTTL: dur("REFRESH_TTL", 30*24*time.Hour),

		OTPTTL:             dur("OTP_TTL", 5*time.Minute),
		SMTPHost:           os.Getenv("SMTP_HOST"),
		SMTPPort:           get("SMTP_PORT", "587"),
		SMTPUser:           os.Getenv("SMTP_USER"),
		SMTPPassword:       os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:           os.Getenv("SMTP_FROM"),
		FCMCredentialsFile: os.Getenv("FCM_CREDENTIALS_FILE"),
		FCMCredentialsJSON: os.Getenv("FCM_CREDENTIALS_JSON"),
		AdminToken:         os.Getenv("ADMIN_TOKEN"),
	}
	c.OTPSecret = get("OTP_SECRET", "")
	for _, o := range strings.Split(get("CORS_ORIGINS", ""), ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.CORSOrigins = append(c.CORSOrigins, o)
		}
	}
	if len(c.JWTSecret) < 32 {
		return c, errors.New("JWT_SECRET must be set and at least 32 characters long (create backend/.env from .env.example, or set the environment variable)")
	}
	if c.OTPSecret == "" {
		c.OTPSecret = c.JWTSecret
	}
	if c.AdminToken != "" && len(c.AdminToken) < 24 {
		return c, errors.New("ADMIN_TOKEN must be at least 24 characters (or leave it empty to disable admin endpoints)")
	}
	if c.SMTPHost != "" && c.SMTPFrom == "" {
		return c, errors.New("SMTP_FROM is required when SMTP_HOST is set")
	}
	return c, nil
}
