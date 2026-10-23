// Command server runs the BirrPulse REST API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "time/tzdata" // bundle tz data so Africa/Addis_Ababa works in minimal containers

	"birrpulse/internal/auth"
	"birrpulse/internal/config"
	"birrpulse/internal/db"
	"birrpulse/internal/handlers"
	"birrpulse/internal/httpx"
	"birrpulse/internal/jobs"
	"birrpulse/internal/mailer"
	"birrpulse/internal/push"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		log.Error("config", "err", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	store, err := db.Connect(ctx, cfg.MongoURI, cfg.MongoDB)
	if err != nil {
		log.Error("mongodb connect", "err", err)
		os.Exit(1)
	}
	defer store.Close(context.Background())
	if err := store.EnsureIndexes(ctx); err != nil {
		log.Error("indexes", "err", err)
		os.Exit(1)
	}

	tokens := &auth.Manager{Secret: []byte(cfg.JWTSecret), AccessTTL: cfg.AccessTTL, RefreshTTL: cfg.RefreshTTL, Store: store}
	authH := &handlers.Auth{Store: store, Tokens: tokens}
	docs := &handlers.Docs{Store: store}
	reports := &handlers.Reports{Store: store}
	misc := &handlers.Misc{Store: store}

	// --- Email (password reset and recovery-email codes) and push sender (FCM) ------------------------------
	var mail mailer.Sender = mailer.LogSender{Log: log}
	if cfg.SMTPHost != "" {
		mail = &mailer.SMTP{Host: cfg.SMTPHost, Port: cfg.SMTPPort, User: cfg.SMTPUser, Password: cfg.SMTPPassword, From: cfg.SMTPFrom}
	}
	mailEnabled := mail.Real() || cfg.Env != "production"
	if !mailEnabled {
		log.Warn("password reset by email disabled: set SMTP_HOST, SMTP_FROM (and credentials) in production")
	}
	recovery := &handlers.Recovery{Store: store, Tokens: tokens, Mail: mail, Secret: []byte(cfg.OTPSecret), TTL: cfg.OTPTTL, Enabled: mailEnabled}

	// Email SIGN-IN codes (the old OTP login) stay disabled; the code is kept commented out in handlers/otp.go.
	// otp := &handlers.OTP{Store: store, Auth: authH, Mail: mail, Secret: []byte(cfg.OTPSecret), TTL: cfg.OTPTTL, Enabled: mailEnabled}

	var pusher push.Sender = push.LogSender{Log: log}
	if creds := loadFCMCreds(cfg); creds != nil {
		fcm, err := push.NewFCM(creds)
		if err != nil {
			log.Error("fcm credentials", "err", err)
			os.Exit(1)
		}
		pusher = fcm
		log.Info("push: Firebase Cloud Messaging enabled", "project", fcm.ProjectID)
	} else {
		log.Warn("push: no FCM credentials, notifications will only be logged (set FCM_CREDENTIALS_FILE)")
	}

	parsers := &handlers.Parsers{Store: store, AdminToken: cfg.AdminToken}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", misc.Health)

	limited := httpx.RateLimit(6*time.Second, 10) // about 10 attempts per minute per IP
	// Sign-up: username + phone + password. Log in: phone + password.
	mux.Handle("POST /api/v1/auth/register", limited(http.HandlerFunc(authH.Register)))
	mux.Handle("POST /api/v1/auth/login", limited(http.HandlerFunc(authH.Login)))
	mux.Handle("POST /api/v1/auth/forgot/request", limited(http.HandlerFunc(recovery.ForgotRequest)))
	mux.Handle("POST /api/v1/auth/forgot/confirm", limited(http.HandlerFunc(recovery.ForgotConfirm)))
	mux.Handle("POST /api/v1/auth/refresh", limited(http.HandlerFunc(authH.Refresh)))
	mux.HandleFunc("POST /api/v1/auth/logout", authH.Logout)
	// Email SIGN-IN codes: DISABLED (kept as comments, code in handlers/otp.go).
	// mux.Handle("POST /api/v1/auth/otp/request", limited(http.HandlerFunc(otp.Request)))
	// mux.Handle("POST /api/v1/auth/otp/verify", limited(http.HandlerFunc(otp.Verify)))

	// Parser configuration is public so guests (no account) get fixes too.
	mux.Handle("GET /api/v1/config/parsers", httpx.RateLimit(time.Second, 30)(http.HandlerFunc(parsers.Public)))
	mux.Handle("GET /api/v1/admin/parsers", parsers.AdminList())
	mux.Handle("PUT /api/v1/admin/parsers/{bankCode}", parsers.AdminPut())
	mux.Handle("DELETE /api/v1/admin/parsers/{bankCode}", parsers.AdminDelete())
	mux.Handle("POST /api/v1/admin/parsers-test", parsers.AdminTest())

	secured := func(pattern string, h http.HandlerFunc) { mux.Handle(pattern, tokens.Require(h)) }
	secured("GET /api/v1/me", authH.Me)
	secured("PATCH /api/v1/me", authH.UpdateProfile)
	secured("POST /api/v1/me/email/request", recovery.LinkEmailRequest)
	secured("POST /api/v1/me/email/verify", recovery.LinkEmailVerify)
	secured("GET /api/v1/me/export", authH.Export)
	secured("DELETE /api/v1/me", authH.DeleteAccount)

	secured("POST /api/v1/sync/push", docs.Push)
	secured("GET /api/v1/sync/pull", docs.Pull)

	for _, c := range db.SyncCollections {
		secured("GET /api/v1/"+c, docs.List(c))
		secured("POST /api/v1/"+c, docs.Create(c))
		secured("GET /api/v1/"+c+"/{id}", docs.Get(c))
		secured("PATCH /api/v1/"+c+"/{id}", docs.Patch(c))
		secured("DELETE /api/v1/"+c+"/{id}", docs.Delete(c))
	}

	secured("GET /api/v1/reports/summary", reports.Summary)
	secured("GET /api/v1/reports/categories", reports.Categories)
	secured("GET /api/v1/reports/cashflow", reports.Cashflow)
	secured("GET /api/v1/reports/export", reports.Export)

	secured("POST /api/v1/devices", misc.RegisterDevice)
	secured("DELETE /api/v1/devices/{token}", misc.RemoveDevice)
	secured("POST /api/v1/sms-samples", misc.SubmitSample)

	handler := httpx.Chain(mux, httpx.Recover(log), httpx.Logging(log), httpx.Secure, httpx.CORS(cfg.CORSOrigins))
	srv := &http.Server{
		Addr: ":" + cfg.Port, Handler: handler,
		ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 60 * time.Second, IdleTimeout: 120 * time.Second,
	}

	runner := &jobs.Runner{Store: store, Pusher: pusher, Log: log}
	go runner.Run(ctx, 15*time.Minute)

	go func() {
		log.Info("listening", "addr", srv.Addr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdown)
	log.Info("stopped")
}

// loadFCMCreds reads the Firebase service account from FCM_CREDENTIALS_JSON or FCM_CREDENTIALS_FILE.
func loadFCMCreds(cfg config.Config) []byte {
	if cfg.FCMCredentialsJSON != "" {
		return []byte(cfg.FCMCredentialsJSON)
	}
	if cfg.FCMCredentialsFile != "" {
		if b, err := os.ReadFile(cfg.FCMCredentialsFile); err == nil {
			return b
		}
	}
	return nil
}
