package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"orbit/internal/intel"
	"orbit/internal/store"
)

type Server struct {
	store      *store.Store
	projection store.Projection
	analytics  Analytics
	identity   *Identity
	ledger     atomic.Pointer[intel.Engine]
	revision   atomic.Uint64
	writes     sync.Mutex
	answerMu   sync.Mutex
	answers    []recentAnswer
	logger     *slog.Logger
	brand      string
}

func New(ctx context.Context, db *store.Store, projection store.Projection, analytics Analytics, identity *Identity, brand string, log *slog.Logger) (*Server, error) {
	s := &Server{store: db, projection: projection, analytics: analytics, identity: identity, brand: brand, logger: log}
	// Bind the storage to one bank (or to local testing) before making any ledger available.
	workspace := identity.registration.Domain
	if identity.localTest {
		workspace = "local-test"
	}
	created, err := db.Create(ctx, "bank-workspace", workspace)
	if err != nil {
		return nil, err
	}
	if !created {
		var current string
		if err = db.Get(ctx, "bank-workspace", &current); err != nil {
			return nil, err
		}
		if current != workspace {
			return nil, errors.New("this storage belongs to a different FFBI workspace")
		}
	}
	if err := s.backfillAccountDirectory(ctx); err != nil {
		s.logger.Warn("account directory backfill failed", "error", err)
	}
	var ledger intel.Ledger
	if err = db.Get(ctx, "bank-ledger", &ledger); err != nil && !errors.Is(err, store.ErrMissing) {
		return nil, err
	}
	if err = s.install(ctx, ledger, false); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Server) install(ctx context.Context, ledger intel.Ledger, persist bool) error {
	engine, err := intel.New(ledger, func(f map[string]intel.Fingerprint) map[string]float64 { return s.analytics.Score(ctx, f) })
	if err != nil {
		return invalidLedger{err}
	}
	if persist {
		if err = s.store.Put(ctx, "bank-ledger", engine.Ledger); err != nil {
			return err
		}
	}
	engine.Discovered = s.analytics.Communities(ctx, engine)
	s.ledger.Store(engine)
	s.revision.Add(1)
	if persist {
		if err = s.projection.Rebuild(ctx, engine.Ledger); err != nil {
			s.logger.Warn("projection rebuild failed", "error", err)
		}
	}
	return nil
}

// SyncProjection lets the HTTP service start while Neo4j warms up.
func (s *Server) SyncProjection(ctx context.Context) {
	if s.projection.URL == "" {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, 4*time.Minute)
	defer cancel()
	for ctx.Err() == nil {
		s.writes.Lock()
		attempt, finish := context.WithTimeout(ctx, 3*time.Second)
		err := s.projection.Rebuild(attempt, s.ledger.Load().Ledger)
		finish()
		s.writes.Unlock()
		if err == nil {
			return
		}
		select {
		case <-ctx.Done():
			s.logger.Warn("startup projection rebuild did not complete", "error", err)
			return
		case <-time.After(5 * time.Second):
		}
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "same-origin")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Cache-Control", "no-store")
	if r.URL.Path == "/healthz" {
		respond(w, 200, map[string]bool{"ok": true})
		return
	}
	if !strings.HasPrefix(r.URL.Path, "/api/") {
		fail(w, 404, "Endpoint not found")
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/")
	if !s.identity.limit(r, path == "login" || strings.HasPrefix(path, "registration/")) {
		w.Header().Set("Retry-After", "60")
		fail(w, 429, "Too many requests. Try again in one minute.")
		return
	}
	if r.Method != http.MethodGet && !s.identity.verifyOrigin(r) {
		fail(w, 403, "Origin is not authorized")
		return
	}
	if path == "login" && r.Method == http.MethodPost {
		s.login(w, r)
		return
	}
	if r.Method == http.MethodGet && path == "registration" {
		registration := s.identity.registration
		localInbox := registration.local && localRegistrationRequest(r)
		enabled := localInbox || !registration.local && !registration.closed && registration.Domain != ""
		respond(w, 200, map[string]bool{"enabled": enabled, "localInbox": localInbox, "closed": registration.closed})
		return
	}
	if r.Method == http.MethodPost && path == "registration/test-inbox" {
		s.readTestInbox(w, r)
		return
	}
	if r.Method == http.MethodPost && (path == "registration/code" || path == "registration/verify") {
		s.register(w, r, path == "registration/verify")
		return
	}
	user, ok := s.identity.read(r)
	if !ok {
		fail(w, 401, "Sign in to continue")
		return
	}
	if path == "logout" && r.Method == http.MethodPost {
		s.identity.clear(w, r)
		s.audit(r, user, "logout", "session")
		respond(w, 200, map[string]bool{"ok": true})
		return
	}
	if path == "accounts" {
		switch r.Method {
		case http.MethodGet:
			s.listAccounts(w, r, user)
		case http.MethodPost:
			s.provisionAccount(w, r, user)
		default:
			fail(w, 405, "Method not allowed")
		}
		return
	}
	if user.Role == platformAdministrator {
		if path == "bootstrap" && r.Method == http.MethodGet {
			respond(w, 200, map[string]any{
				"user": user, "brand": s.brand, "managedRole": managedRole(user.Role),
				"summary": intel.Summary{Buckets: []intel.Bucket{}, Findings: []intel.Finding{}},
			})
		} else {
			fail(w, 403, "Platform administrators manage accounts")
		}
		return
	}
	e := s.ledger.Load()
	switch r.Method {
	case http.MethodGet:
		s.read(w, r, e, user, path)
	case http.MethodPost:
		s.write(w, r, e, user, path)
	default:
		fail(w, 405, "Method not allowed")
	}
}

func (s *Server) read(w http.ResponseWriter, r *http.Request, e *intel.Engine, u User, path string) {
	q := r.URL.Query()
	switch {
	case path == "bootstrap":
		respond(w, 200, map[string]any{"user": u, "brand": s.brand, "summary": e.Summary(), "managedRole": managedRole(u.Role)})
	case path == "graph":
		after, before, err := parseGraphDates(q.Get("after"), q.Get("before"))
		if err != nil {
			fail(w, 400, "Invalid historical date range")
			return
		}
		limit, _ := strconv.Atoi(q.Get("limit"))
		if limit == 0 {
			limit = 38
		}
		respond(w, 200, e.Graph(intel.GraphOptions{
			Focus: q.Get("focus"), Finding: q.Get("finding"), Layout: q.Get("layout"), Community: q.Get("community"),
			After: after, Before: before, Limit: limit, Expand: split(q.Get("expand")), Hide: split(q.Get("hide")),
		}))
	case path == "search":
		text := strings.TrimSpace(q.Get("q"))
		txs := []intel.Transaction{}
		if tx, ok := e.ByID[text]; ok {
			txs = append(txs, tx)
		} else if tx, ok := e.ByID[strings.ToUpper(text)]; ok {
			txs = append(txs, tx)
		}
		respond(w, 200, map[string]any{"entities": e.Search(text, 12), "transactions": txs})
	case strings.HasPrefix(path, "entities/"):
		id := strings.TrimPrefix(path, "entities/")
		d, ok := e.Detail(id)
		if !ok {
			fail(w, 404, "Entity not found")
			return
		}
		respond(w, 200, d)
	case strings.HasPrefix(path, "transactions/"):
		id := strings.TrimPrefix(path, "transactions/")
		tx, ok := e.ByID[id]
		if !ok {
			fail(w, 404, "Transaction not found")
			return
		}
		respond(w, 200, tx)
	case path == "transactions":
		if id := q.Get("reference"); id != "" {
			tx, ok := e.ByID[id]
			if !ok {
				fail(w, 404, "Transaction not found")
				return
			}
			respond(w, 200, tx)
			return
		}
		page, _ := strconv.Atoi(q.Get("page"))
		page = min(100000, max(0, page))
		records := e.Ledger.Transactions
		if id := q.Get("entity"); id != "" {
			records = e.ByAccount[id]
		}
		start := min(len(records), page*40)
		end := min(len(records), start+40)
		result := []intel.Transaction{}
		for i := start; i < end; i++ {
			result = append(result, records[len(records)-1-i])
		}
		respond(w, 200, map[string]any{"items": result, "total": len(records), "page": page})
	case path == "communities":
		respond(w, 200, e.Communities())
	case path == "relationships":
		respond(w, 200, e.Relationships(q.Get("entity")))
	case path == "similarity":
		respond(w, 200, e.Similar(q.Get("entity")))
	case path == "temporal":
		end, err := parseDate(q.Get("before"))
		if err != nil {
			fail(w, 400, "Invalid historical date")
			return
		}
		respond(w, 200, e.Temporal(q.Get("entity"), end, 24))
	case strings.HasPrefix(path, "stories/"):
		f, ok := e.Finding(strings.TrimPrefix(path, "stories/"))
		if !ok {
			fail(w, 404, "Finding not found")
			return
		}
		respond(w, 200, e.Story(f))
	case path == "events":
		s.events(w, r)
	case path == "audit":
		if u.Role != "administrator" && u.Role != "auditor" {
			fail(w, 403, "Audit access requires an administrator or auditor")
			return
		}
		records, err := s.store.RecentAudit(r.Context())
		if err != nil {
			fail(w, 500, "Audit records unavailable")
			return
		}
		respond(w, 200, records)
	case path == "cases":
		s.listCases(w, r, u)
	case strings.HasPrefix(path, "cases/"):
		s.caseRoute(w, r, u, path, e)
	default:
		fail(w, 404, "Endpoint not found")
	}
}

func (s *Server) write(w http.ResponseWriter, r *http.Request, e *intel.Engine, u User, path string) {
	switch {
	case path == "investigate":
		var req struct{ Question, Focus, Finding string }
		if !body(w, r, &req, 8192) {
			return
		}
		req.Question = strings.TrimSpace(req.Question)
		if req.Question == "" || len(req.Question) > 600 {
			fail(w, 400, "Enter a question of up to 600 characters")
			return
		}
		f, _ := e.Finding(req.Finding)
		answer := e.Investigate(s.analytics.Intent(r.Context(), req.Question), req.Focus, req.Question, f)
		if answer.Kind != "assistant" {
			answer.ID = token()[:24]
			s.rememberFinding(u.Name, req.Finding, answer)
			s.audit(r, u, "investigate", req.Finding)
		}
		respond(w, 200, answer)
	case path == "simulation":
		var req struct{ Finding, Action, Target string }
		if !body(w, r, &req, 8192) {
			return
		}
		f, ok := e.Finding(req.Finding)
		if !ok {
			fail(w, 400, "Choose a finding for the scenario")
			return
		}
		switch req.Action {
		case "remove-account", "disconnect-account":
			ok = slices.Contains(f.Entities, req.Target) && e.Entities[req.Target].Kind == "account"
		case "remove-transaction":
			ok = slices.Contains(f.Transactions, req.Target)
		default:
			ok = false
		}
		if !ok {
			fail(w, 400, "Choose a valid scenario target")
			return
		}
		s.audit(r, u, "simulate", req.Finding)
		respond(w, 200, e.Simulate(f, req.Action, req.Target))
	case path == "ingest":
		s.ingest(w, r, u)
	case path == "cases":
		s.createCase(w, r, u, e)
	case strings.HasPrefix(path, "cases/"):
		s.caseRoute(w, r, u, path, e)
	default:
		fail(w, 404, "Endpoint not found")
	}
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req struct{ Username, Email, Password string }
	if !body(w, r, &req, 8192) {
		return
	}
	if req.Email == "" {
		req.Email = req.Username
	}
	user, ok := s.authenticate(r, req.Email, req.Password)
	if !ok {
		s.audit(r, User{Name: "anonymous"}, "failed login", "session")
		fail(w, 401, "Invalid email or password")
		return
	}
	s.identity.clear(w, r)
	s.identity.issue(w, user)
	s.audit(r, user, "login", "session")
	respond(w, 200, user)
}

func (s *Server) events(w http.ResponseWriter, r *http.Request) {
	controller := http.NewResponseController(w)
	_ = controller.SetWriteDeadline(time.Time{})
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("X-Accel-Buffering", "no")
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	var last uint64
	for {
		cur := s.revision.Load()
		if cur != last {
			if _, err := fmt.Fprintf(w, "event: ledger\ndata: %d\n\n", cur); err != nil {
				return
			}
			last = cur
		} else if _, err := io.WriteString(w, ": heartbeat\n\n"); err != nil {
			return
		}
		if controller.Flush() != nil {
			return
		}
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Server) audit(r *http.Request, u User, action, ref string) {
	if len(ref) > 100 {
		ref = ref[:100]
	}
	if err := s.store.Audit(r.Context(), u.Name, action, ref); err != nil {
		s.logger.Warn("audit write failed", "action", action, "error", err)
	}
}

func respond(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
func fail(w http.ResponseWriter, status int, msg string) {
	respond(w, status, map[string]string{"error": msg})
}

func body(w http.ResponseWriter, r *http.Request, dest any, limit int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dest); err != nil {
		fail(w, 400, "Invalid or oversized JSON payload")
		return false
	}
	if dec.Decode(new(any)) != io.EOF {
		fail(w, 400, "Expected a single JSON object")
		return false
	}
	return true
}

func parseGraphDates(start, end string) (time.Time, time.Time, error) {
	before, err := parseDate(end)
	if err != nil || start == "" {
		return time.Time{}, before, err
	}
	after, err := time.Parse(time.DateOnly, start)
	if err == nil && !before.IsZero() && after.After(before) {
		err = errors.New("start day is after end day")
	}
	return after, before, err
}

func parseDate(raw string) (time.Time, error) {
	if raw == "" {
		return time.Time{}, nil
	}
	if t, err := time.Parse(time.DateOnly, raw); err == nil {
		return t.Add(24*time.Hour - time.Second), nil
	}
	return time.Parse(time.RFC3339, raw)
}
func split(s string) []string {
	if s == "" {
		return nil
	}
	v := strings.Split(s, ",")
	return v[:min(30, len(v))]
}

type recentAnswer struct {
	owner, finding string
	answer         intel.Answer
	at             time.Time
}

func (s *Server) rememberFinding(owner, finding string, answer intel.Answer) {
	s.answerMu.Lock()
	defer s.answerMu.Unlock()
	now := time.Now()
	first := 0
	for first < len(s.answers) && (now.Sub(s.answers[first].at) > time.Hour || len(s.answers)-first >= 500) {
		first++
	}
	if first > 0 {
		s.answers = slices.Delete(s.answers, 0, first)
	}
	s.answers = append(s.answers, recentAnswer{owner, finding, answer, now})
}

func (s *Server) recentFinding(id, owner, finding string) (intel.Answer, bool) {
	s.answerMu.Lock()
	defer s.answerMu.Unlock()
	for i := len(s.answers) - 1; i >= 0; i-- {
		entry := s.answers[i]
		if time.Since(entry.at) > time.Hour {
			break
		}
		if entry.answer.ID == id && entry.owner == owner && entry.finding == finding {
			return entry.answer, true
		}
	}
	return intel.Answer{}, false
}
