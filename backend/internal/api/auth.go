package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	Name string `json:"name"`
	Role string `json:"role"`
}
type accountConfig struct {
	Name     string `json:"name"`
	Role     string `json:"role"`
	Password string `json:"password"`
}
type credential struct {
	user User
	hash []byte
}
type session struct {
	User  User
	Until time.Time
}
type quota struct {
	Count int
	Reset time.Time
}

type Identity struct {
	mu            sync.Mutex
	accountWrites sync.Mutex
	accounts      map[string]credential
	sessions      map[string]session
	quotas        map[string]quota
	localTest     bool
	secure        bool
	allowedOrigin string
	dummy         []byte
	lastCleanup   time.Time
	registration  Registration
	pending       map[string]emailChallenge
}

const localEmailDomain = "northstar.example"
const platformAdministrator = "platform administrator"
const LocalAnalystEmail = "analyst@" + localEmailDomain
const LocalAnalystPassword = "FFBI-Local-Analyst-2026!"

func NewIdentity(accountsJSON string, localTest, secure bool, origin string, registration Registration) (*Identity, error) {
	if err := registration.validate(); err != nil {
		return nil, err
	}
	if localTest && (secure || registration.Domain != "" && !registration.local) {
		return nil, errors.New("local test login requires an isolated local workspace")
	}
	if !localTest && (!secure || registration.Domain == "" || registration.local) {
		return nil, errors.New("bank mode requires secure cookies and corporate email registration")
	}
	i := &Identity{
		accounts: map[string]credential{}, sessions: map[string]session{}, quotas: map[string]quota{},
		localTest: localTest, secure: secure, allowedOrigin: strings.TrimRight(origin, "/"), registration: registration, pending: map[string]emailChallenge{},
	}
	var config []accountConfig
	if accountsJSON != "" && json.Unmarshal([]byte(accountsJSON), &config) != nil {
		return nil, errors.New("ORBIT_USERS must contain a JSON array")
	}
	for _, a := range config {
		email, domain, ok := corporateEmail(a.Name)
		if !ok || len(a.Password) < 12 || len(a.Password) > 72 || !validRole(a.Role) ||
			(localTest && (domain != localEmailDomain || a.Role != "senior analyst" && a.Role != "administrator" && a.Role != platformAdministrator)) ||
			(!localTest && (domain != registration.Domain || a.Role == "analyst" && !registration.closed)) {
			return nil, errors.New("invalid configured account")
		}
		if _, exists := i.accounts[email]; exists {
			return nil, errors.New("duplicate configured account")
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(a.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		i.accounts[email] = credential{User{email, a.Role}, hash}
	}
	if localTest {
		if _, exists := i.accounts[LocalAnalystEmail]; exists {
			return nil, errors.New("the built-in local analyst address is reserved")
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(LocalAnalystPassword), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		i.accounts[LocalAnalystEmail] = credential{User{LocalAnalystEmail, "analyst"}, hash}
	}
	i.dummy, _ = bcrypt.GenerateFromPassword([]byte("unregistered-orbit-account"), bcrypt.DefaultCost)
	return i, nil
}

func validRole(role string) bool {
	return role == platformAdministrator || role == "administrator" || role == "analyst" || role == "senior analyst" || role == "auditor"
}

func token() string { b := make([]byte, 24); _, _ = rand.Read(b); return hex.EncodeToString(b) }

func (i *Identity) issue(w http.ResponseWriter, u User) {
	id := token()
	http.SetCookie(w, &http.Cookie{Name: "orbit_session", Value: id, Path: "/", HttpOnly: true, Secure: i.secure, SameSite: http.SameSiteStrictMode, MaxAge: 8 * 60 * 60})
	i.mu.Lock()
	defer i.mu.Unlock()
	i.sessions[id] = session{u, time.Now().Add(8 * time.Hour)}
}

func (i *Identity) read(r *http.Request) (User, bool) {
	c, err := r.Cookie("orbit_session")
	if err != nil {
		return User{}, false
	}
	i.mu.Lock()
	defer i.mu.Unlock()
	s, ok := i.sessions[c.Value]
	return s.User, ok && time.Now().Before(s.Until)
}

func (i *Identity) clear(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie("orbit_session")
	if err == nil {
		i.mu.Lock()
		delete(i.sessions, c.Value)
		i.mu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{Name: "orbit_session", Value: "", Path: "/", HttpOnly: true, Secure: i.secure, SameSite: http.SameSiteStrictMode, MaxAge: -1})
}

func (i *Identity) limit(r *http.Request, login bool) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	limit := 360
	if login {
		host += "/login"
		limit = 12
	}
	now := time.Now()
	i.mu.Lock()
	defer i.mu.Unlock()
	if now.Sub(i.lastCleanup) > 2*time.Minute {
		for k, v := range i.quotas {
			if now.After(v.Reset) {
				delete(i.quotas, k)
			}
		}
		for k, v := range i.sessions {
			if now.After(v.Until) {
				delete(i.sessions, k)
			}
		}
		for email, pending := range i.pending {
			if !now.Before(pending.Expires) {
				delete(i.pending, email)
			}
		}
		i.lastCleanup = now
	}
	q := i.quotas[host]
	if q.Reset.IsZero() || !now.Before(q.Reset) {
		q = quota{Reset: now.Add(time.Minute)}
	}
	q.Count++
	i.quotas[host] = q
	return q.Count <= limit
}

func (i *Identity) verifyOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	if i.allowedOrigin != "" {
		return origin == i.allowedOrigin
	}
	return origin == "http://"+r.Host || origin == "https://"+r.Host
}
