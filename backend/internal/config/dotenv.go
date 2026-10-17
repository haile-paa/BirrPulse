package config

import (
	"bufio"
	"os"
	"strings"
)

// LoadEnvFile loads ./.env for command line tools such as the seed command (the server does this inside Load).
func LoadEnvFile() { loadDotEnv(".env") }

// loadDotEnv reads KEY=VALUE lines from a local .env file (if it exists) into the process environment.
// Variables that are already set are never overwritten, so real environment settings and Docker always win.
// It understands comments, "export KEY=value", quotes and Windows (CRLF) line endings.
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	first := true
	for sc.Scan() {
		line := sc.Text()
		if first {
			line = strings.TrimPrefix(line, "\ufeff") // UTF-8 BOM added by some Windows editors
			first = false
		}
		line = strings.TrimSpace(line) // also removes a trailing \r
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		key, val, ok := strings.Cut(line, "=")
		key, val = strings.TrimSpace(key), strings.TrimSpace(val)
		if !ok || key == "" {
			continue
		}
		if len(val) >= 2 && (val[0] == '"' && val[len(val)-1] == '"' || val[0] == '\'' && val[len(val)-1] == '\'') {
			val = val[1 : len(val)-1]
		}
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, val)
		}
	}
}
