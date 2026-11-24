package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orbit/internal/intel"
	"orbit/internal/store"
)

func testServer(t *testing.T) *Server {
	t.Helper()
	ctx := context.Background()
	db, err := store.Open(ctx, "", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	identity, err := NewIdentity("", true, false, "", Registration{})
	if err != nil {
		t.Fatal(err)
	}
	server, err := New(ctx, db, store.Projection{}, Analytics{}, identity, "ORBIT", slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	return server
}

type testClient struct {
	server  *Server
	session *http.Cookie
	peer    string
}

func (c *testClient) request(t *testing.T, method, path string, data any, status int, out any) *httptest.ResponseRecorder {
	t.Helper()
	raw, err := json.Marshal(data)
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(method, "http://orbit.test/api/"+path, bytes.NewReader(raw))
	if c.peer != "" {
		r.Host = "127.0.0.1"
		r.RemoteAddr = c.peer
	}
	if c.session != nil {
		r.AddCookie(c.session)
	}
	w := httptest.NewRecorder()
	c.server.ServeHTTP(w, r)
	if w.Code != status {
		t.Fatalf("%s %s returned %d, expected %d: %s", method, path, w.Code, status, w.Body)
	}
	for _, cookie := range w.Result().Cookies() {
		if cookie.Name == "orbit_session" && cookie.Value != "" {
			c.session = cookie
		}
	}
	if out != nil && json.Unmarshal(w.Body.Bytes(), out) != nil {
		t.Fatalf("cannot decode: %s", w.Body)
	}
	return w
}

func (c *testClient) assume(user User) {
	w := httptest.NewRecorder()
	c.server.identity.issue(w, user)
	c.session = w.Result().Cookies()[0]
}

func TestInvestigationWorkflowAndAuthorization(t *testing.T) {
	s := testServer(t)
	const reviewerEmail = "senior@northstar.example"
	const reviewerPassword = "Local-review-test-2026!"
	var err error
	s.identity, err = NewIdentity(`[{"name":"`+reviewerEmail+`","role":"senior analyst","password":"`+reviewerPassword+`"}]`, true, false, "", LocalRegistration())
	if err != nil {
		t.Fatal(err)
	}
	if err := s.install(context.Background(), intel.Synthetic(), false); err != nil {
		t.Fatal(err)
	}
	c := testClient{server: s}
	c.request(t, "GET", "graph", nil, 401, nil)
	var boot struct {
		User    User
		Summary intel.Summary
	}
	c.request(t, "GET", "bootstrap", nil, 401, nil)
	c.request(t, "POST", "login", map[string]string{"email": LocalAnalystEmail, "password": LocalAnalystPassword}, 200, nil)
	c.request(t, "GET", "bootstrap", nil, 200, &boot)
	if c.session == nil || !c.session.HttpOnly || c.session.SameSite != http.SameSiteStrictMode {
		t.Fatal("unsafe or absent session cookie")
	}
	f := boot.Summary.Findings[0]
	c.request(t, "POST", "seed", map[string]string{}, 404, nil)
	var graph intel.Graph
	c.request(t, "GET", "graph?finding="+f.ID, nil, 200, &graph)
	if len(graph.Nodes) == 0 {
		t.Fatal("missing graph nodes")
	}
	var day intel.Graph
	c.request(t, "GET", "graph?finding="+f.ID+"&after=2026-11-12&before=2026-11-12", nil, 200, &day)
	if day.Window == 0 || day.Window >= graph.Window {
		t.Fatalf("unexpected ranged transfer count: %d", day.Window)
	}
	for _, edge := range day.Edges {
		for _, reference := range edge.Transactions {
			if date := s.ledger.Load().ByID[reference].Time.UTC().Format("2006-01-02"); date != "2026-11-12" {
				t.Errorf("transaction outside the selected UTC day: %s", reference)
			}
		}
	}
	c.request(t, "GET", "graph?after=2026-11-13&before=2026-11-12", nil, 400, nil)

	var story intel.Story
	c.request(t, "GET", "stories/"+f.ID, nil, 200, &story)
	if len(story.Steps) != 12 {
		t.Fatal("missing demo story")
	}
	for _, tc := range []struct{ question, want string }{
		{"как дела", "small-talk"},
		{"как тебя зовут", "identity"},
		{"как загрузить файл", "import-help"},
		{"как приготовить борщ", "out-of-scope"},
	} {
		var reply intel.Answer
		c.request(t, "POST", "investigate", map[string]string{"question": tc.question, "focus": f.Subject, "finding": f.ID}, 200, &reply)
		if reply.Intent != tc.want || reply.Kind != "assistant" || reply.Text == "" || reply.ID != "" || len(reply.Evidence) != 0 {
			t.Fatalf("unexpected assistant response to %q: %+v", tc.question, reply)
		}
	}
	var answer intel.Answer
	c.request(t, "POST", "investigate", map[string]string{"question": "Where did the money go?", "focus": f.Subject, "finding": f.ID}, 200, &answer)
	if answer.Intent != "flow" || len(answer.Evidence) != len(story.Steps) {
		t.Fatalf("unexpected investigator result: %+v", answer)
	}
	c.request(t, "POST", "simulation", map[string]string{"finding": f.ID, "action": "disconnect-account", "target": f.Subject}, 200, nil)
	var caseRecord Case
	c.request(t, "POST", "cases", map[string]string{"title": "Test review", "finding": f.ID}, 201, &caseRecord)
	prefix := "cases/" + caseRecord.ID + "/"
	c.request(t, "POST", prefix+"note", map[string]string{"text": "Review counterparty documentation."}, 200, nil)
	c.request(t, "POST", prefix+"evidence", map[string]string{"reference": f.Transactions[0]}, 200, nil)
	c.request(t, "POST", prefix+"finding", map[string]string{"reference": answer.ID}, 200, nil)
	c.request(t, "POST", prefix+"snapshot", map[string]string{"layout": "Time", "after": "2026-10-20", "before": "2026-10-23", "focus": f.Subject}, 200, nil)
	c.request(t, "POST", prefix+"scenario", map[string]string{"action": "remove-account", "target": f.Subject}, 200, nil)
	c.request(t, "POST", prefix+"status", map[string]string{"status": "In review"}, 200, nil)
	c.request(t, "POST", prefix+"status", map[string]string{"status": "Reviewed", "text": "Close review."}, 400, nil)
	var exported Case
	c.request(t, "GET", prefix+"json", nil, 200, &exported)
	if len(exported.Notes) != 1 || len(exported.Evidence) != 1 || len(exported.SavedFindings) != 1 || len(exported.Scenarios) != 1 || len(exported.Graph.Nodes) != 38 || len(exported.Snapshots) != 1 || exported.Snapshots[0].After != "2026-10-20" || exported.SavedFindings[0].ID != answer.ID {
		t.Fatal("export omitted parts of the investigation")
	}
	pdf := c.request(t, "GET", prefix+"pdf", nil, 200, nil)
	if pdf.Header().Get("Content-Type") != "application/pdf" || !strings.HasPrefix(pdf.Body.String(), "%PDF-") {
		t.Fatal("invalid PDF response")
	}
	other := testClient{server: s}
	other.assume(User{"different@northstar.example", "analyst"})
	other.request(t, "GET", "cases/"+caseRecord.ID, nil, 404, nil)
	other.assume(User{"auditor@northstar.example", "auditor"})
	other.request(t, "GET", prefix+"json", nil, 200, nil)
	other.request(t, "POST", prefix+"note", map[string]string{"text": "Auditor write"}, 403, nil)
	other.request(t, "GET", "audit", nil, 200, nil)
	other.request(t, "POST", "login", map[string]string{"email": reviewerEmail, "password": reviewerPassword}, 200, nil)
	other.request(t, "POST", prefix+"status", map[string]string{"status": "Reviewed", "text": "The evidence supports follow-up with the synthetic counterparty."}, 200, &exported)
	if exported.Status != "Reviewed" || exported.Reviewer != reviewerEmail {
		t.Fatal("senior review not recorded")
	}
	c.request(t, "POST", prefix+"note", map[string]string{"text": "Case is closed."}, 409, nil)
}

func TestCrossOriginWriteRejected(t *testing.T) {
	s := testServer(t)
	c := testClient{server: s}
	c.assume(User{LocalAnalystEmail, "analyst"})
	r := httptest.NewRequest("POST", "http://orbit.test/api/seed", strings.NewReader("{}"))
	r.AddCookie(c.session)
	r.Header.Set("Origin", "http://external.invalid")
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatalf("cross origin write returned %d", w.Code)
	}
}

func TestVerifiedAnalystImportsAndAnalyzesBankCSV(t *testing.T) {
	ctx := context.Background()
	db, err := store.Open(ctx, "", t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	// A pre-upgrade demo ledger must never become the bank's active ledger.
	if err := db.Put(ctx, "ledger", intel.Synthetic()); err != nil {
		t.Fatal(err)
	}
	var verification string
	config := Registration{Domain: "bank.example", Send: func(_ context.Context, to, code string) error {
		if to != "employee@bank.example" {
			t.Fatalf("unexpected recipient %s", to)
		}
		verification = code
		return nil
	}}
	start := func() *Server {
		identity, err := NewIdentity("", false, true, "", config)
		if err != nil {
			t.Fatal(err)
		}
		service, err := New(ctx, db, store.Projection{}, Analytics{}, identity, "FFBI", slog.New(slog.NewTextHandler(io.Discard, nil)))
		if err != nil {
			t.Fatal(err)
		}
		return service
	}
	c := testClient{server: start()}
	email, password := "employee@bank.example", "Analyst-passphrase-2026"
	c.request(t, "POST", "ingest", map[string]string{}, 401, nil)
	c.request(t, "POST", "registration/code", map[string]string{"email": "employee@public.example"}, 400, nil)
	c.request(t, "POST", "registration/code", map[string]string{"email": "Employee@BANK.EXAMPLE"}, 202, nil)
	c.request(t, "POST", "registration/verify", map[string]string{"email": email, "code": "bad", "password": password}, 400, nil)
	req := map[string]string{"email": email, "code": verification, "password": password}
	var user User
	c.request(t, "POST", "registration/verify", req, 201, &user)
	c.request(t, "POST", "registration/verify", req, 400, nil)
	if user.Name != email || user.Role != "analyst" || !c.session.Secure {
		t.Fatalf("unexpected analyst session: %+v", user)
	}

	var boot struct{ Summary intel.Summary }
	c.request(t, "GET", "bootstrap", nil, 200, &boot)
	if boot.Summary.Transactions != 0 || boot.Summary.Accounts != 0 || !boot.Summary.Start.IsZero() || len(boot.Summary.Buckets) != 0 {
		t.Fatal("workspace contained data before import")
	}
	csv := "id,from,to,amount,currency,kind,time\n" +
		"wire.01,origin,alpha,20000,USD,wire,2026-08-03T14:00:00+05:00\n" +
		"wire.02,origin,beta,20001,USD,wire,2026-08-03T14:01:00+05:00\n" +
		"wire.03,origin,gamma,20002,USD,wire,2026-08-03T14:02:00+05:00\n" +
		"wire.04,origin,delta,20003,USD,wire,2026-08-03T14:03:00+05:00\n"
	var result struct {
		Added   int
		Summary intel.Summary
	}
	c.request(t, "POST", "ingest", map[string]string{"csv": csv}, 201, &result)
	flagged := false
	for _, f := range result.Summary.Findings {
		if f.Kind == "rapid" && f.Subject == "origin" && len(f.Transactions) == 4 && len(f.Checks) > 0 {
			flagged = true
		}
	}
	if result.Added != 4 || result.Summary.Transactions != 4 || result.Summary.Accounts != 5 || !flagged {
		t.Fatalf("unexpected analysis: %+v", result)
	}
	c.request(t, "POST", "ingest", map[string]string{"csv": strings.Replace(csv, "20000", "20099", 1)}, 409, nil)
	c.request(t, "POST", "ingest", map[string]string{"csv": csv + "bad.01,origin,new,1,KZT,wire,2026-08-03T14:04:00+05:00\n"}, 400, nil)

	c = testClient{server: start()}
	c.request(t, "POST", "login", map[string]string{"email": email, "password": password}, 200, nil)
	c.request(t, "POST", "ingest", map[string]string{"csv": csv}, 201, &result)
	if result.Added != 0 || result.Summary.Transactions != 4 || result.Summary.Accounts != 5 {
		t.Fatalf("duplicate retry or rejected import affected persisted data: %+v", result)
	}
	c.request(t, "GET", "transactions/wire.04", nil, 200, nil)
	c.request(t, "POST", "ingest", json.RawMessage(`{"transactions":[{"id":"wire.05","from":"delta","to":"new","amount":5000,"currency":"KZT","usd":10,"kind":"wire","time":"2026-08-03T09:06:00Z"}]}`), 201, &result)
	if result.Added != 1 || result.Summary.Transactions != 5 || result.Summary.Accounts != 6 {
		t.Fatalf("unexpected JSON analysis: %+v", result)
	}
	c.assume(User{"auditor@bank.example", "auditor"})
	c.request(t, "POST", "ingest", map[string]string{"csv": csv}, 403, nil)
}

func TestTestInboxIsLoopbackOnly(t *testing.T) {
	s := testServer(t)
	var err error
	s.identity, err = NewIdentity("", true, false, "", LocalRegistration())
	if err != nil {
		t.Fatal(err)
	}
	const recipient = "new-analyst@northstar.example"
	send := func(path, host, peer, payload string, status int) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(http.MethodPost, "http://"+host+"/api/registration/"+path, strings.NewReader(payload))
		r.RemoteAddr = peer
		w := httptest.NewRecorder()
		s.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s returned %d, expected %d: %s", path, w.Code, status, w.Body)
		}
		return w
	}
	request := `{"email":"` + recipient + `"}`
	send("code", "127.0.0.1", "192.0.2.5:40000", request, 404)
	send("code", "127.0.0.1", "127.0.0.1:40000", request, 202)
	send("test-inbox", "ffbi.example", "127.0.0.1:40000", request, 404)
	send("test-inbox", "127.0.0.1", "192.0.2.5:40000", request, 404)
	var letter struct{ Code string }
	mail := send("test-inbox", "localhost:5173", "127.0.0.1:40000", request, 200)
	if err := json.Unmarshal(mail.Body.Bytes(), &letter); err != nil || len(letter.Code) != 8 {
		t.Fatal("missing test verification code")
	}
	send("verify", "localhost:5173", "127.0.0.1:40000", `{"email":"`+recipient+`","code":"`+letter.Code+`","password":"Local-inbox-test-2026!"}`, 201)
	send("test-inbox", "localhost:5173", "127.0.0.1:40000", request, 404)
	if _, err := NewIdentity("", false, true, "https://ffbi.example", LocalRegistration()); err == nil {
		t.Fatal("bank mode accepted the test inbox")
	}
}

func TestManagedAccountsActivateOnlyTheirAssignedRole(t *testing.T) {
	s := testServer(t)
	const password = "Managed-account-test-2026!"
	var err error
	s.identity, err = NewIdentity(`[{"name":"platform@northstar.example","role":"platform administrator","password":"`+password+`"}]`, true, false, "", LocalRegistration())
	if err != nil {
		t.Fatal(err)
	}

	platform := testClient{server: s, peer: "127.0.0.2:9123"}
	platform.request(t, "POST", "login", map[string]string{"email": "platform@northstar.example", "password": password}, 200, nil)
	platform.request(t, "GET", "cases", nil, 403, nil)
	platform.request(t, "GET", "graph", nil, 403, nil)
	var boot struct {
		ManagedRole string
		Summary     intel.Summary
	}
	platform.request(t, "GET", "bootstrap", nil, 200, &boot)
	if boot.ManagedRole != "administrator" || boot.Summary.Transactions != 0 {
		t.Fatal("platform bootstrap must be limited to account management")
	}

	provision := func(creator *testClient, address, role, peer string) testClient {
		t.Helper()
		var intended User
		req := map[string]string{"email": address}
		creator.request(t, "POST", "accounts", req, 201, &intended)
		if intended.Role != role {
			t.Fatalf("created role %q instead of %q", intended.Role, role)
		}
		creator.request(t, "POST", "accounts", req, 409, nil)

		member := testClient{server: s, peer: peer}
		login := map[string]string{"email": address, "password": password}
		member.request(t, "POST", "login", login, 401, nil)
		member.request(t, "POST", "registration/code", req, 202, nil)
		var inbox struct{ Code string }
		member.request(t, "POST", "registration/test-inbox", req, 200, &inbox)
		var activated User
		member.request(t, "POST", "registration/verify", map[string]string{"email": address, "code": inbox.Code, "password": password}, 201, &activated)
		if activated != intended {
			t.Fatalf("activation changed the assigned user: %+v", activated)
		}
		member.request(t, "POST", "login", login, 200, &activated)
		if activated != intended {
			t.Fatalf("stored role was lost at login: %+v", activated)
		}
		return member
	}
	bank := provision(&platform, "bank@northstar.example", "administrator", "127.0.0.3:9123")
	bank.request(t, "POST", "accounts", map[string]string{"email": "wrong@northstar.example", "role": platformAdministrator}, 400, nil)
	senior := provision(&bank, "senior@northstar.example", "senior analyst", "127.0.0.4:9123")
	analyst := provision(&senior, "new@northstar.example", "analyst", "127.0.0.5:9123")
	analyst.request(t, "POST", "accounts", map[string]string{"email": "other@northstar.example"}, 403, nil)
	analyst.request(t, "GET", "accounts", nil, 403, nil)
	const pendingEmail = "pending@northstar.example"
	senior.request(t, "POST", "accounts", map[string]string{"email": pendingEmail}, 201, nil)
	otherSenior := testClient{server: s}
	otherSenior.assume(User{"other-senior@northstar.example", "senior analyst"})
	otherSenior.request(t, "POST", "accounts", map[string]string{"email": "other-team@northstar.example"}, 201, nil)
	for index, c := range []Case{
		{Owner: "new@northstar.example", Status: "In review"},
		{Owner: "new@northstar.example", Reviewer: "senior@northstar.example", Status: "Reviewed"},
	} {
		if err := s.store.Put(context.Background(), fmt.Sprintf("bank-case-directory-%d", index), c); err != nil {
			t.Fatal(err)
		}
	}
	readDirectory := func(client *testClient) map[string]accountDirectoryEntry {
		t.Helper()
		var entries []accountDirectoryEntry
		client.request(t, "GET", "accounts", nil, 200, &entries)
		byEmail := map[string]accountDirectoryEntry{}
		for _, entry := range entries {
			byEmail[entry.Email] = entry
		}
		return byEmail
	}
	team := readDirectory(&senior)
	if len(team) != 2 || team[pendingEmail].Active || !team["new@northstar.example"].Active ||
		team["new@northstar.example"].Activity != (accountActivity{Cases: 2, InReview: 1, Reviewed: 1}) {
		t.Fatalf("unexpected senior team and case stats: %+v", team)
	}
	bankDirectory := readDirectory(&bank)
	if len(bankDirectory) != 1 || bankDirectory["senior@northstar.example"].Activity.ReviewsCompleted != 1 {
		t.Fatalf("unexpected bank directory and review stats: %+v", bankDirectory)
	}
	all := readDirectory(&platform)
	if len(all) != 6 || all["bank@northstar.example"].Role != "administrator" || all["other-team@northstar.example"].Role != "analyst" {
		t.Fatalf("unexpected platform directory: %+v", all)
	}

	const legacyEmail = "legacy@northstar.example"
	if err := s.store.Put(context.Background(), accountKey(legacyEmail), s.identity.accounts[LocalAnalystEmail].hash); err != nil {
		t.Fatal(err)
	}
	if err := s.store.Audit(context.Background(), "senior@northstar.example", "create managed account", legacyEmail); err != nil {
		t.Fatal(err)
	}
	if err := s.backfillAccountDirectory(context.Background()); err != nil {
		t.Fatal(err)
	}
	if readDirectory(&senior)[legacyEmail].CreatedBy != "senior@northstar.example" {
		t.Fatal("legacy analyst is missing from the creator's directory")
	}
	var legacy User
	senior.request(t, "POST", "login", map[string]string{"email": legacyEmail, "password": LocalAnalystPassword}, 200, &legacy)
	if legacy.Role != "analyst" {
		t.Fatal("legacy analyst can no longer sign in")
	}
}

func TestClosedRegistrationAllowsConfiguredLoginOnly(t *testing.T) {
	s := testServer(t)
	var err error
	s.identity, err = NewIdentity(`[{"name":"analyst@northstar.example","role":"analyst","password":"Private-login-only-2026!"}]`, false, true, "", ClosedRegistration("northstar.example"))
	if err != nil {
		t.Fatal(err)
	}
	c := testClient{server: s}
	var registration map[string]bool
	c.request(t, "GET", "registration", nil, 200, &registration)
	if !registration["closed"] || registration["enabled"] || registration["localInbox"] {
		t.Fatalf("unexpected closed registration configuration: %v", registration)
	}
	c.request(t, "POST", "registration/code", map[string]string{"email": "new@northstar.example"}, 503, nil)
	c.request(t, "POST", "registration/verify", map[string]string{"email": "new@northstar.example"}, 503, nil)
	c.request(t, "POST", "registration/test-inbox", map[string]string{"email": "new@northstar.example"}, 404, nil)
	c.request(t, "GET", "transactions", nil, 401, nil)
	c.request(t, "POST", "login", map[string]string{"email": LocalAnalystEmail, "password": LocalAnalystPassword}, 401, nil)
	c.request(t, "POST", "login", map[string]string{"email": LocalAnalystEmail, "password": "Private-login-only-2026!"}, 200, nil)
	if c.session == nil || !c.session.Secure {
		t.Fatal("missing secure session")
	}
	c.request(t, "GET", "transactions", nil, 200, nil)
}
