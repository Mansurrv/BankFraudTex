package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"orbit/internal/store"
)

type storedAccount struct {
	Email     string `json:"email,omitempty"`
	Role      string `json:"role"`
	Hash      []byte `json:"hash,omitempty"`
	CreatedBy string `json:"createdBy,omitempty"`
}

func (a *storedAccount) UnmarshalJSON(data []byte) error {
	if len(data) > 0 && data[0] == '"' {
		// Existing registrations stored the analyst's bcrypt hash alone.
		a.Role = "analyst"
		return json.Unmarshal(data, &a.Hash)
	}
	type record storedAccount
	return json.Unmarshal(data, (*record)(a))
}

func managedRole(role string) string {
	switch role {
	case platformAdministrator:
		return "administrator"
	case "administrator":
		return "senior analyst"
	case "senior analyst":
		return "analyst"
	default:
		return ""
	}
}

func (i *Identity) accountDomain() string {
	if i.localTest {
		return localEmailDomain
	}
	return i.registration.Domain
}

func (s *Server) provisionAccount(w http.ResponseWriter, r *http.Request, creator User) {
	role := managedRole(creator.Role)
	if role == "" {
		fail(w, 403, "Your role cannot create accounts")
		return
	}
	var req struct{ Email string }
	if !body(w, r, &req, 8192) {
		return
	}
	email, domain, valid := corporateEmail(req.Email)
	if !valid || domain != s.identity.accountDomain() {
		fail(w, 400, "Use an authorized corporate email address")
		return
	}
	if _, exists := s.identity.accounts[email]; exists {
		fail(w, 409, "An account already exists for this email")
		return
	}
	s.identity.accountWrites.Lock()
	created, err := s.store.Create(r.Context(), accountKey(email), storedAccount{
		Email: email, Role: role, CreatedBy: creator.Name,
	})
	s.identity.accountWrites.Unlock()
	if err != nil {
		s.logger.Error("reserve managed account", "error", err)
		fail(w, 500, "Unable to create the account")
		return
	}
	if !created {
		fail(w, 409, "An account already exists for this email")
		return
	}
	s.audit(r, creator, "create managed account", email)
	respond(w, 201, User{Name: email, Role: role})
}

var errAccountExists = errors.New("account already exists")

func (s *Server) activateAccount(ctx context.Context, email string, hash []byte) (User, error) {
	s.identity.accountWrites.Lock()
	defer s.identity.accountWrites.Unlock()
	if _, exists := s.identity.accounts[email]; exists {
		return User{}, errAccountExists
	}
	key := accountKey(email)
	var account storedAccount
	err := s.store.Get(ctx, key, &account)
	if errors.Is(err, store.ErrMissing) {
		account = storedAccount{Email: email, Role: "analyst", Hash: hash}
		created, err := s.store.Create(ctx, key, account)
		if err != nil {
			return User{}, err
		}
		if !created {
			return User{}, errAccountExists
		}
	} else if err != nil {
		return User{}, err
	} else {
		if len(account.Hash) > 0 || !validRole(account.Role) || account.Role == platformAdministrator {
			return User{}, errAccountExists
		}
		account.Email, account.Hash = email, hash
		if err := s.store.Put(ctx, key, account); err != nil {
			return User{}, err
		}
	}
	return User{Name: email, Role: account.Role}, nil
}
