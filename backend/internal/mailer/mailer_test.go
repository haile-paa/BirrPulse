package mailer

import (
	"bufio"
	"context"
	"net"
	"strings"
	"testing"
)

// fakeSMTP is a tiny SMTP server that records the DATA section of one message.
func fakeSMTP(t *testing.T) (port string, got chan string) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	got = make(chan string, 1)
	go func() {
		defer l.Close()
		c, err := l.Accept()
		if err != nil {
			return
		}
		defer c.Close()
		r := bufio.NewReader(c)
		w := func(s string) { _, _ = c.Write([]byte(s + "\r\n")) }
		w("220 fake ESMTP")
		var data strings.Builder
		inData := false
		for {
			line, err := r.ReadString('\n')
			if err != nil {
				return
			}
			line = strings.TrimRight(line, "\r\n")
			if inData {
				if line == "." {
					inData = false
					got <- data.String()
					w("250 queued")
					continue
				}
				data.WriteString(line + "\n")
				continue
			}
			switch {
			case strings.HasPrefix(line, "EHLO"), strings.HasPrefix(line, "HELO"):
				w("250 fake")
			case strings.HasPrefix(line, "MAIL"), strings.HasPrefix(line, "RCPT"):
				w("250 ok")
			case line == "DATA":
				inData = true
				w("354 go")
			case line == "QUIT":
				w("221 bye")
				return
			default:
				w("250 ok")
			}
		}
	}()
	_, port, _ = net.SplitHostPort(l.Addr().String())
	return port, got
}

func TestSMTPSend(t *testing.T) {
	port, got := fakeSMTP(t)
	s := &SMTP{Host: "127.0.0.1", Port: port, From: "no-reply@birrpulse.test"}
	if err := s.Send(context.Background(), "user@example.com", "Your code", "Code: 123456"); err != nil {
		t.Fatal(err)
	}
	msg := <-got
	for _, want := range []string{"To: user@example.com", "Subject: Your code", "Code: 123456"} {
		if !strings.Contains(msg, want) {
			t.Fatalf("message is missing %q:\n%s", want, msg)
		}
	}
}

func TestSMTPRejectsHeaderInjection(t *testing.T) {
	s := &SMTP{Host: "127.0.0.1", Port: "1", From: "a@b.c"}
	if err := s.Send(context.Background(), "x@y.z\r\nBcc: evil@e.com", "s", "t"); err == nil {
		t.Fatal("must reject CR/LF in headers")
	}
}
