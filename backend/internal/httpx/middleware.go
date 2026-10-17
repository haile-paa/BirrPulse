package httpx

import (
	"log/slog"
	"net"
	"net/http"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (s *statusWriter) WriteHeader(c int) { s.status = c; s.ResponseWriter.WriteHeader(c) }

// Logging writes one structured line per request.
func Logging(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, status: 200}
			next.ServeHTTP(sw, r)
			log.Info("request", "method", r.Method, "path", r.URL.Path, "status", sw.status, "ms", time.Since(start).Milliseconds())
		})
	}
}

// Recover turns panics into a 500 instead of crashing the server.
func Recover(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if v := recover(); v != nil {
					log.Error("panic", "value", v, "stack", string(debug.Stack()))
					Error(w, http.StatusInternalServerError, "internal error")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// Secure adds basic security headers to every response.
func Secure(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// CORS only allows the configured origins. Native mobile apps do not need it.
func CORS(origins []string) func(http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, o := range origins {
		allowed[o] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if o := r.Header.Get("Origin"); o != "" && allowed[o] {
				w.Header().Set("Access-Control-Allow-Origin", o)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
				if r.Method == http.MethodOptions {
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

type visitor struct {
	lim  *rate.Limiter
	seen time.Time
}

// RateLimit allows `burst` requests at once per client IP and refills one every `every`.
// It keys on the connection address; put a trusted proxy in front and adapt this if you rely on X-Forwarded-For.
func RateLimit(every time.Duration, burst int) func(http.Handler) http.Handler {
	var mu sync.Mutex
	visitors := map[string]*visitor{}
	go func() {
		for range time.Tick(5 * time.Minute) {
			mu.Lock()
			for ip, v := range visitors {
				if time.Since(v.seen) > 15*time.Minute {
					delete(visitors, ip)
				}
			}
			mu.Unlock()
		}
	}()
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip, _, err := net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				ip = strings.TrimSpace(r.RemoteAddr)
			}
			mu.Lock()
			v, ok := visitors[ip]
			if !ok {
				v = &visitor{lim: rate.NewLimiter(rate.Every(every), burst)}
				visitors[ip] = v
			}
			v.seen = time.Now()
			allowed := v.lim.Allow()
			mu.Unlock()
			if !allowed {
				w.Header().Set("Retry-After", "30")
				Error(w, http.StatusTooManyRequests, "too many attempts, try again shortly")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// Chain applies middleware so the first listed runs first.
func Chain(h http.Handler, mws ...func(http.Handler) http.Handler) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}
