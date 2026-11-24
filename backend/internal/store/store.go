package store

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"orbit/migrations"
)

var ErrMissing = errors.New("record not found")

type Store struct {
	db   *pgxpool.Pool
	root string
	mu   sync.Mutex
}

func Open(ctx context.Context, url, root string) (*Store, error) {
	s := &Store{root: root}
	if url == "" {
		return s, os.MkdirAll(root, 0700)
	}
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if _, err = db.Exec(ctx, migrations.Initial, pgx.QueryExecModeSimpleProtocol); err != nil {
		db.Close()
		return nil, err
	}
	s.db = db
	return s, nil
}

func (s *Store) Close() {
	if s.db != nil {
		s.db.Close()
	}
}

func (s *Store) Get(ctx context.Context, key string, dest any) error {
	var data []byte
	var err error
	if s.db != nil {
		err = s.db.QueryRow(ctx, "SELECT content FROM orbit_records WHERE key=$1", key).Scan(&data)
	} else {
		data, err = os.ReadFile(filepath.Join(s.root, key+".json"))
	}
	if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, os.ErrNotExist) {
		return ErrMissing
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}

func (s *Store) Put(ctx context.Context, key string, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if s.db != nil {
		_, err = s.db.Exec(ctx, "INSERT INTO orbit_records(key,content) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET content=EXCLUDED.content, updated_at=now()", key, data)
		return err
	}
	_, err = s.writeFile(key, data, false)
	return err
}

// Create persists a record only if its key is unused.
func (s *Store) Create(ctx context.Context, key string, value any) (bool, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return false, err
	}
	if s.db != nil {
		result, err := s.db.Exec(ctx, "INSERT INTO orbit_records(key,content) VALUES($1,$2) ON CONFLICT(key) DO NOTHING", key, data)
		return result.RowsAffected() == 1, err
	}
	return s.writeFile(key, data, true)
}

func (s *Store) writeFile(key string, data []byte, exclusive bool) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	file, err := os.CreateTemp(s.root, "writing-")
	if err != nil {
		return false, err
	}
	defer os.Remove(file.Name())
	_, writeErr := file.Write(data)
	if err = file.Close(); err != nil {
		return false, err
	}
	if writeErr != nil {
		return false, writeErr
	}
	path := filepath.Join(s.root, key+".json")
	if exclusive {
		err = os.Link(file.Name(), path)
		if errors.Is(err, os.ErrExist) {
			return false, nil
		}
	} else {
		err = os.Rename(file.Name(), path)
	}
	return err == nil, err
}

func (s *Store) List(ctx context.Context, prefix string) ([]json.RawMessage, error) {
	result := []json.RawMessage{}
	if s.db != nil {
		rows, err := s.db.Query(ctx, "SELECT content FROM orbit_records WHERE starts_with(key,$1) ORDER BY updated_at DESC", prefix)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var raw json.RawMessage
			if err = rows.Scan(&raw); err != nil {
				return nil, err
			}
			result = append(result, raw)
		}
		return result, rows.Err()
	}
	files, err := os.ReadDir(s.root)
	if err != nil {
		return nil, err
	}
	sort.Slice(files, func(i, j int) bool {
		a, ea := files[i].Info()
		b, eb := files[j].Info()
		return ea == nil && eb == nil && a.ModTime().After(b.ModTime())
	})
	for _, file := range files {
		if file.IsDir() || !strings.HasPrefix(file.Name(), prefix) || !strings.HasSuffix(file.Name(), ".json") {
			continue
		}
		b, err := os.ReadFile(filepath.Join(s.root, file.Name()))
		if err != nil {
			return nil, err
		}
		result = append(result, b)
	}
	return result, nil
}

type AuditRecord struct {
	Actor     string    `json:"actor"`
	Action    string    `json:"action"`
	Reference string    `json:"reference"`
	At        time.Time `json:"at"`
}

func (s *Store) Audit(ctx context.Context, actor, action, reference string) error {
	if s.db != nil {
		_, err := s.db.Exec(ctx, "INSERT INTO orbit_audit(actor,action,reference) VALUES($1,$2,$3)", actor, action, reference)
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	f, err := os.OpenFile(filepath.Join(s.root, "audit.jsonl"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	return json.NewEncoder(f).Encode(AuditRecord{actor, action, reference, time.Now().UTC()})
}

func (s *Store) RecentAudit(ctx context.Context) ([]AuditRecord, error) {
	return s.readAudit(ctx, false)
}

func (s *Store) AccountAudit(ctx context.Context) ([]AuditRecord, error) {
	return s.readAudit(ctx, true)
}

func (s *Store) readAudit(ctx context.Context, accountHistory bool) ([]AuditRecord, error) {
	records := []AuditRecord{}
	if s.db != nil {
		query := "SELECT actor,action,reference,created_at FROM orbit_audit ORDER BY id DESC LIMIT 100"
		if accountHistory {
			query = "SELECT actor,action,reference,created_at FROM orbit_audit WHERE action IN ('create managed account', 'register verified account', 'register verified analyst', 'login') ORDER BY id DESC"
		}
		rows, err := s.db.Query(ctx, query)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var r AuditRecord
			if err = rows.Scan(&r.Actor, &r.Action, &r.Reference, &r.At); err != nil {
				return nil, err
			}
			records = append(records, r)
		}
		return records, rows.Err()
	}
	b, err := os.ReadFile(filepath.Join(s.root, "audit.jsonl"))
	if errors.Is(err, os.ErrNotExist) {
		return records, nil
	}
	if err != nil {
		return nil, err
	}
	lines := strings.Split(strings.TrimSpace(string(b)), "\n")
	for i := len(lines) - 1; i >= 0 && (accountHistory || len(records) < 100); i-- {
		var r AuditRecord
		if json.Unmarshal([]byte(lines[i]), &r) == nil {
			if accountHistory && r.Action != "create managed account" && r.Action != "register verified account" && r.Action != "register verified analyst" && r.Action != "login" {
				continue
			}
			records = append(records, r)
		}
	}
	return records, nil
}

type CaseActivity struct {
	Owner    string `json:"owner"`
	Reviewer string `json:"reviewer"`
	Status   string `json:"status"`
}

func (s *Store) CaseActivities(ctx context.Context) ([]CaseActivity, error) {
	var result []CaseActivity
	if s.db != nil {
		rows, err := s.db.Query(ctx, "SELECT COALESCE(content->>'owner',''), COALESCE(content->>'reviewer',''), COALESCE(content->>'status','') FROM orbit_records WHERE starts_with(key,'bank-case-')")
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var activity CaseActivity
			if err := rows.Scan(&activity.Owner, &activity.Reviewer, &activity.Status); err != nil {
				return nil, err
			}
			result = append(result, activity)
		}
		return result, rows.Err()
	}
	docs, err := s.List(ctx, "bank-case-")
	if err != nil {
		return nil, err
	}
	for _, doc := range docs {
		var activity CaseActivity
		if err := json.Unmarshal(doc, &activity); err != nil {
			return nil, err
		}
		result = append(result, activity)
	}
	return result, nil
}
