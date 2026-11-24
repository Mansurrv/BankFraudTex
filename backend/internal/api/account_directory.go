package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sort"

	"orbit/internal/store"
)

const accountPrefix = "bank-analyst-"

type accountActivity struct {
	Cases            int `json:"cases"`
	InReview         int `json:"inReview"`
	Reviewed         int `json:"reviewed"`
	ReviewsCompleted int `json:"reviewsCompleted"`
}

type accountDirectoryEntry struct {
	Email     string          `json:"email"`
	Role      string          `json:"role"`
	Active    bool            `json:"active"`
	CreatedBy string          `json:"createdBy,omitempty"`
	Activity  accountActivity `json:"activity"`
}

func canListAccount(viewer User, role, creator string) bool {
	switch viewer.Role {
	case platformAdministrator:
		return role == "administrator" || role == "senior analyst" || role == "analyst"
	case "administrator":
		return role == "senior analyst"
	case "senior analyst":
		return role == "analyst" && creator == viewer.Name
	default:
		return false
	}
}

func (s *Server) listAccounts(w http.ResponseWriter, r *http.Request, viewer User) {
	if managedRole(viewer.Role) == "" {
		fail(w, 403, "Your role cannot view account directories")
		return
	}
	entries, err := s.accountDirectory(r.Context(), viewer)
	if err != nil {
		s.logger.Warn("read account directory", "error", err)
		fail(w, 500, "Account directory unavailable")
		return
	}
	respond(w, 200, entries)
}

func (s *Server) accountDirectory(ctx context.Context, viewer User) ([]accountDirectoryEntry, error) {
	docs, err := s.store.List(ctx, accountPrefix)
	if err != nil {
		return nil, err
	}
	byEmail := map[string]*accountDirectoryEntry{}
	for _, doc := range docs {
		var record storedAccount
		if err := json.Unmarshal(doc, &record); err != nil {
			return nil, err
		}
		if record.Email == "" || !canListAccount(viewer, record.Role, record.CreatedBy) {
			continue
		}
		if _, configured := s.identity.accounts[record.Email]; configured {
			continue
		}
		byEmail[record.Email] = &accountDirectoryEntry{
			Email: record.Email, Role: record.Role, Active: len(record.Hash) > 0, CreatedBy: record.CreatedBy,
		}
	}
	for email, credential := range s.identity.accounts {
		if canListAccount(viewer, credential.user.Role, "") {
			byEmail[email] = &accountDirectoryEntry{Email: email, Role: credential.user.Role, Active: true}
		}
	}

	result := make([]accountDirectoryEntry, 0, len(byEmail))
	if len(byEmail) == 0 {
		return result, nil
	}
	activities, err := s.store.CaseActivities(ctx)
	if err != nil {
		return nil, err
	}
	for _, item := range activities {
		if owner := byEmail[item.Owner]; owner != nil {
			owner.Activity.Cases++
			switch item.Status {
			case "In review":
				owner.Activity.InReview++
			case "Reviewed":
				owner.Activity.Reviewed++
			}
		}
		if reviewer := byEmail[item.Reviewer]; reviewer != nil && item.Status == "Reviewed" {
			reviewer.Activity.ReviewsCompleted++
		}
	}
	for _, entry := range byEmail {
		result = append(result, *entry)
	}
	order := map[string]int{"administrator": 0, "senior analyst": 1, "analyst": 2}
	sort.Slice(result, func(i, j int) bool {
		a, b := result[i], result[j]
		if a.Role != b.Role {
			return order[a.Role] < order[b.Role]
		}
		return a.Email < b.Email
	})
	return result, nil
}

func (s *Server) backfillAccountDirectory(ctx context.Context) error {
	docs, err := s.store.List(ctx, accountPrefix)
	if err != nil {
		return err
	}
	hasLegacy := false
	for _, doc := range docs {
		var record storedAccount
		if err := json.Unmarshal(doc, &record); err != nil {
			return err
		}
		if record.Email == "" {
			hasLegacy = true
			break
		}
	}
	if !hasLegacy {
		return nil
	}

	audit, err := s.store.AccountAudit(ctx)
	if err != nil {
		return err
	}
	contacts := map[string]string{}
	for _, event := range audit {
		if event.Action == "create managed account" {
			contacts[event.Reference] = event.Actor
		} else if _, known := contacts[event.Actor]; !known {
			contacts[event.Actor] = ""
		}
	}
	for candidate, creator := range contacts {
		email, domain, valid := corporateEmail(candidate)
		if !valid || domain != s.identity.accountDomain() {
			continue
		}
		if err := s.restoreAccountMetadata(ctx, email, creator); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) restoreAccountMetadata(ctx context.Context, email, creator string) error {
	s.identity.accountWrites.Lock()
	defer s.identity.accountWrites.Unlock()
	key := accountKey(email)
	var account storedAccount
	err := s.store.Get(ctx, key, &account)
	if errors.Is(err, store.ErrMissing) {
		return nil
	}
	if err != nil || account.Email != "" {
		return err
	}
	account.Email, account.CreatedBy = email, creator
	return s.store.Put(ctx, key, account)
}
