package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"errors"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"regexp"
	"strings"
	"time"

	"orbit/internal/store"

	"golang.org/x/crypto/bcrypt"
)

type Registration struct {
	Domain string
	Send   func(context.Context, string, string) error
	local  bool
	closed bool
}

func LocalRegistration() Registration {
	return Registration{Domain: localEmailDomain, local: true}
}

func ClosedRegistration(domain string) Registration {
	return Registration{Domain: strings.ToLower(strings.TrimSpace(domain)), closed: true}
}

var domainPattern = regexp.MustCompile(`^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$`)
var emailLocalPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9._%+\-]{0,63}$`)

func (r Registration) validate() error {
	if r.Domain != "" && (!domainPattern.MatchString(r.Domain) || !r.local && !r.closed && r.Send == nil) {
		return errors.New("corporate registration requires a valid domain and SMTP sender")
	}
	return nil
}

func corporateEmail(raw string) (email, domain string, ok bool) {
	email = strings.ToLower(strings.TrimSpace(raw))
	local, domain, found := strings.Cut(email, "@")
	if !found || len(email) > 254 || !emailLocalPattern.MatchString(local) || !domainPattern.MatchString(domain) {
		return "", "", false
	}
	_, err := mail.ParseAddress(email)
	return email, domain, err == nil
}

type emailChallenge struct {
	Digest   [32]byte
	Expires  time.Time
	Attempts int
	TestCode string
}

func localRegistrationRequest(r *http.Request) bool {
	peer, _, err := net.SplitHostPort(r.RemoteAddr)
	host, _, splitErr := net.SplitHostPort(r.Host)
	if splitErr != nil {
		host = strings.Trim(r.Host, "[]")
	}
	return err == nil && net.ParseIP(peer).IsLoopback() &&
		(strings.EqualFold(host, "localhost") || net.ParseIP(host).IsLoopback())
}

func (s *Server) readTestInbox(w http.ResponseWriter, r *http.Request) {
	if !s.identity.registration.local || !localRegistrationRequest(r) {
		fail(w, 404, "Endpoint not found")
		return
	}
	var req struct{ Email string }
	if !body(w, r, &req, 8192) {
		return
	}
	email, _, _ := corporateEmail(req.Email)
	s.identity.mu.Lock()
	challenge := s.identity.pending[email]
	s.identity.mu.Unlock()
	if challenge.TestCode == "" || !time.Now().Before(challenge.Expires) || challenge.Attempts >= 5 {
		fail(w, 404, "No active verification email in the test inbox")
		return
	}
	respond(w, 200, map[string]string{"code": challenge.TestCode})
}

func accountKey(email string) string {
	return fmt.Sprintf("%s%x", accountPrefix, sha256.Sum256([]byte(email)))
}

func (s *Server) authenticate(r *http.Request, email, password string) (User, bool) {
	email, domain, valid := corporateEmail(email)
	c, ok := s.identity.accounts[email]
	var record storedAccount
	if !ok && valid && domain == s.identity.accountDomain() {
		err := s.store.Get(r.Context(), accountKey(email), &record)
		if err == nil && len(record.Hash) > 0 && validRole(record.Role) && record.Role != platformAdministrator {
			c, ok = credential{User{email, record.Role}, record.Hash}, true
		} else if err != nil && !errors.Is(err, store.ErrMissing) {
			s.logger.Error("read stored account", "error", err)
		}
	}
	if !ok {
		c.hash = s.identity.dummy
	}
	err := bcrypt.CompareHashAndPassword(c.hash, []byte(password))
	authenticated := ok && err == nil
	if authenticated && len(record.Hash) > 0 && record.Email == "" {
		if err := s.restoreAccountMetadata(r.Context(), email, ""); err != nil {
			s.logger.Warn("restore account email", "error", err)
		}
	}
	return c.user, authenticated
}

func (s *Server) register(w http.ResponseWriter, r *http.Request, verify bool) {
	i := s.identity
	registration := i.registration
	if registration.local && !localRegistrationRequest(r) {
		fail(w, 404, "Endpoint not found")
		return
	}
	if registration.closed || registration.Domain == "" {
		fail(w, 503, "Corporate registration is unavailable in this workspace")
		return
	}
	var req struct{ Email, Code, Password string }
	if !body(w, r, &req, 8192) {
		return
	}
	email, domain, ok := corporateEmail(req.Email)
	if !ok || domain != registration.Domain {
		fail(w, 400, "Use an authorized corporate email address")
		return
	}
	if verify {
		s.verifyRegistration(w, r, email, req.Code, req.Password)
		return
	}

	candidate, err := rand.Int(rand.Reader, big.NewInt(100_000_000))
	if err != nil {
		fail(w, 500, "Unable to issue a verification code")
		return
	}
	code := fmt.Sprintf("%08d", candidate.Int64())
	now := time.Now()
	challenge := emailChallenge{Digest: sha256.Sum256([]byte(code)), Expires: now.Add(10 * time.Minute)}
	if registration.local {
		challenge.TestCode = code
	}
	i.mu.Lock()
	previous := i.pending[email]
	if now.Before(previous.Expires.Add(-9 * time.Minute)) {
		i.mu.Unlock()
		fail(w, 429, "Wait one minute before requesting another code")
		return
	}
	i.pending[email] = challenge
	i.mu.Unlock()

	if !registration.local {
		err = registration.Send(r.Context(), email, code)
	}
	if err != nil {
		i.mu.Lock()
		if i.pending[email].Digest == challenge.Digest {
			delete(i.pending, email)
		}
		i.mu.Unlock()
		s.logger.Error("send corporate verification email", "error", err)
		fail(w, 503, "Unable to deliver the verification email")
		return
	}
	respond(w, 202, map[string]bool{"sent": true})
}

func (s *Server) verifyRegistration(w http.ResponseWriter, r *http.Request, email, code, password string) {
	if len(password) < 12 || len(password) > 72 {
		fail(w, 400, "Password must contain 12–72 bytes")
		return
	}
	i := s.identity
	digest := sha256.Sum256([]byte(strings.TrimSpace(code)))
	i.mu.Lock()
	challenge, ok := i.pending[email]
	if !ok || !time.Now().Before(challenge.Expires) || challenge.Attempts >= 5 {
		i.mu.Unlock()
		fail(w, 400, "Verification code is invalid or expired")
		return
	}
	challenge.Attempts++
	i.pending[email] = challenge
	if subtle.ConstantTimeCompare(digest[:], challenge.Digest[:]) != 1 {
		i.mu.Unlock()
		fail(w, 400, "Verification code is invalid or expired")
		return
	}
	delete(i.pending, email)
	i.mu.Unlock()

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fail(w, 500, "Unable to register the account")
		return
	}
	user, err := s.activateAccount(r.Context(), email, hash)
	if errors.Is(err, errAccountExists) {
		fail(w, 409, "An account already exists for this email")
		return
	}
	if err != nil {
		s.logger.Error("persist verified account", "error", err)
		fail(w, 500, "Unable to register the account")
		return
	}
	i.clear(w, r)
	i.issue(w, user)
	s.audit(r, user, "register verified account", "session")
	respond(w, 201, user)
}

func SMTPRegistration(domain, address, from, username, password string) (Registration, error) {
	domain = strings.ToLower(strings.TrimSpace(domain))
	if domain == "" {
		return Registration{}, nil
	}
	host, _, err := net.SplitHostPort(address)
	sender, senderErr := mail.ParseAddress(from)
	if err != nil || host == "" || senderErr != nil || sender.Address != from || (username == "") != (password == "") {
		return Registration{}, errors.New("configure SMTP host:port, sender address and optional matching credentials")
	}
	return Registration{Domain: domain, Send: func(ctx context.Context, to, code string) error {
		ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
		defer cancel()
		conn, err := (&net.Dialer{}).DialContext(ctx, "tcp", address)
		if err != nil {
			return err
		}
		defer conn.Close()
		deadline, _ := ctx.Deadline()
		if err := conn.SetDeadline(deadline); err != nil {
			return err
		}
		client, err := smtp.NewClient(conn, host)
		if err != nil {
			return err
		}
		defer client.Close()
		if err = client.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
		if username != "" {
			if err = client.Auth(smtp.PlainAuth("", username, password, host)); err != nil {
				return err
			}
		}
		if err = client.Mail(from); err != nil {
			return err
		}
		if err = client.Rcpt(to); err != nil {
			return err
		}
		message, err := client.Data()
		if err != nil {
			return err
		}
		_, err = fmt.Fprintf(message, "From: %s\r\nTo: %s\r\nSubject: FFBI verification code\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nYour FFBI verification code is %s. It expires in 10 minutes.\r\n", from, to, code)
		if err != nil {
			return err
		}
		return message.Close()
	}}, nil
}
