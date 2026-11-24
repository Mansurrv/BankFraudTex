package api

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
	"orbit/internal/intel"
	"orbit/internal/store"
)

//go:embed fonts/NotoSans-Regular.ttf
var reportRegular []byte

//go:embed fonts/NotoSans-Bold.ttf
var reportBold []byte

type Note struct {
	Author string    `json:"author"`
	Text   string    `json:"text"`
	At     time.Time `json:"at"`
}

type Scenario struct {
	Action     string           `json:"action"`
	Target     string           `json:"target"`
	Comparison intel.Simulation `json:"comparison"`
}

type CaseSnapshot struct {
	After  string      `json:"after,omitempty"`
	Label  string      `json:"label"`
	Layout string      `json:"layout"`
	Before string      `json:"before,omitempty"`
	At     time.Time   `json:"at"`
	Graph  intel.Graph `json:"graph"`
}

type Case struct {
	Snapshots     []CaseSnapshot   `json:"snapshots,omitempty"`
	ID            string           `json:"id"`
	Title         string           `json:"title"`
	Status        string           `json:"status"`
	Owner         string           `json:"owner"`
	Reviewer      string           `json:"reviewer,omitempty"`
	Created       time.Time        `json:"created"`
	Updated       time.Time        `json:"updated"`
	Finding       intel.Finding    `json:"finding"`
	Graph         intel.Graph      `json:"graph"`
	Timeline      intel.Story      `json:"timeline"`
	Summary       intel.Answer     `json:"summary"`
	Notes         []Note           `json:"notes"`
	Evidence      []intel.Evidence `json:"evidence"`
	SavedFindings []intel.Answer   `json:"savedFindings"`
	Scenarios     []Scenario       `json:"scenarios"`
	Conclusion    string           `json:"conclusion"`
}

func (s *Server) listCases(w http.ResponseWriter, r *http.Request, u User) {
	docs, err := s.store.List(r.Context(), "bank-case-")
	if err != nil {
		fail(w, 500, "Cases unavailable")
		return
	}
	result := []map[string]any{}
	for _, d := range docs {
		var c Case
		if json.Unmarshal(d, &c) != nil || !canRead(c, u) {
			continue
		}
		result = append(result, map[string]any{"id": c.ID, "title": c.Title, "status": c.Status, "owner": c.Owner, "updated": c.Updated, "finding": c.Finding.ID})
	}
	respond(w, 200, result)
}

func canRead(c Case, u User) bool {
	return c.Owner == u.Name || u.Role == "administrator" || u.Role == "senior analyst" || u.Role == "auditor"
}

func (s *Server) createCase(w http.ResponseWriter, r *http.Request, u User, e *intel.Engine) {
	if u.Role == "auditor" {
		fail(w, 403, "Auditor access is read-only")
		return
	}
	var req struct{ Title, Finding string }
	if !body(w, r, &req, 8192) {
		return
	}
	title := strings.TrimSpace(req.Title)
	f, ok := e.Finding(req.Finding)
	if !ok || len(title) < 3 || len(title) > 120 {
		fail(w, 400, "Choose a finding and enter a case title of 3–120 characters")
		return
	}
	now := time.Now().UTC()
	c := Case{
		ID: token()[:12], Title: title, Status: "Open", Owner: u.Name, Created: now, Updated: now, Finding: f,
		Graph:    e.Graph(intel.GraphOptions{Finding: f.ID, Layout: "Communities", Limit: 38}),
		Timeline: e.Story(f), Summary: e.Investigate("report", f.Subject, "", f),
		Notes: []Note{}, Evidence: []intel.Evidence{}, SavedFindings: []intel.Answer{}, Scenarios: []Scenario{},
	}
	if err := s.store.Put(r.Context(), "bank-case-"+c.ID, c); err != nil {
		fail(w, 500, "Case could not be saved")
		return
	}
	s.audit(r, u, "create case", c.ID)
	respond(w, 201, c)
}

func (s *Server) caseRoute(w http.ResponseWriter, r *http.Request, u User, path string, e *intel.Engine) {
	parts := strings.Split(path, "/")
	if len(parts) < 2 || len(parts) > 3 || len(parts[1]) != 12 || !bankID.MatchString(parts[1]) {
		fail(w, 404, "Case not found")
		return
	}
	id := parts[1]
	if r.Method == http.MethodPost {
		s.writes.Lock()
		defer s.writes.Unlock()
	}
	var c Case
	err := s.store.Get(r.Context(), "bank-case-"+id, &c)
	if errors.Is(err, store.ErrMissing) || err == nil && !canRead(c, u) {
		fail(w, 404, "Case not found")
		return
	}
	if err != nil {
		fail(w, 500, "Case unavailable")
		return
	}
	action := ""
	if len(parts) == 3 {
		action = parts[2]
	}
	if r.Method == http.MethodGet {
		switch action {
		case "":
			respond(w, 200, c)
		case "json":
			s.audit(r, u, "export JSON", id)
			w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=orbit-case-%s.json", id))
			respond(w, 200, c)
		case "pdf":
			pdf, err := s.casePDF(c)
			if err != nil {
				s.logger.Error("PDF export failed", "error", err)
				fail(w, 500, "PDF export failed")
				return
			}
			s.audit(r, u, "export PDF", id)
			w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=orbit-case-%s.pdf", id))
			w.Header().Set("Content-Type", "application/pdf")
			_, _ = w.Write(pdf)
		default:
			fail(w, 404, "Case endpoint not found")
		}
		return
	}
	if u.Role == "auditor" || c.Owner != u.Name && u.Role != "administrator" && u.Role != "senior analyst" {
		fail(w, 403, "Write access is restricted")
		return
	}
	if c.Status == "Reviewed" {
		fail(w, 409, "Reviewed cases are closed")
		return
	}
	var req struct{ Text, Reference, Status, Target, Action, Question, Focus, Layout, After, Before, Community, Expand, Hide string }
	if !body(w, r, &req, 16000) {
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	switch action {
	case "note":
		if len(req.Text) < 1 || len(req.Text) > 3000 || len(c.Notes) >= 100 {
			fail(w, 400, "Enter a note of up to 3,000 characters")
			return
		}
		c.Notes = append(c.Notes, Note{u.Name, req.Text, time.Now().UTC()})
	case "evidence":
		var item intel.Evidence
		for _, v := range c.Finding.Evidence {
			if v.ID == req.Reference {
				item = v
				break
			}
		}
		if item.ID == "" {
			if t, ok := e.ByID[req.Reference]; ok {
				item = e.TxEvidence(t)
			}
		}
		if item.ID == "" || len(c.Evidence) >= 100 {
			fail(w, 400, "Choose a ledger evidence reference")
			return
		}
		for _, ev := range c.Evidence {
			if ev.ID == item.ID {
				respond(w, 200, c)
				return
			}
		}
		c.Evidence = append(c.Evidence, item)
	case "snapshot":
		after, before, err := parseGraphDates(req.After, req.Before)
		if err != nil || len(c.Snapshots) >= 12 {
			fail(w, 400, "Invalid snapshot date or snapshot limit reached")
			return
		}
		if !slices.Contains([]string{"Communities", "Force-directed", "Hierarchical", "Geography", "Time", "Risk"}, req.Layout) {
			fail(w, 400, "Choose a supported graph layout")
			return
		}
		options := intel.GraphOptions{Finding: c.Finding.ID, Focus: req.Focus, Community: req.Community, Layout: req.Layout, After: after, Before: before, Expand: split(req.Expand), Hide: split(req.Hide)}
		options.Limit = min(144, 38+len(options.Expand)*8)
		snapshot := e.Graph(options)
		c.Snapshots = append(c.Snapshots, CaseSnapshot{Label: "Saved network view", Layout: req.Layout, After: req.After, Before: req.Before, At: time.Now().UTC(), Graph: snapshot})
	case "finding":
		if req.Reference != "" {
			item, ok := s.recentFinding(req.Reference, u.Name, c.Finding.ID)
			if !ok || len(c.SavedFindings) >= 30 {
				fail(w, 400, "Select a recent investigation response from this finding")
				return
			}
			for _, existing := range c.SavedFindings {
				if existing.ID == item.ID {
					respond(w, 200, c)
					return
				}
			}
			c.SavedFindings = append(c.SavedFindings, item)
			break
		}
		if len(req.Question) < 1 || len(req.Question) > 600 || len(c.SavedFindings) >= 30 {
			fail(w, 400, "Enter an investigation question")
			return
		}
		f, ok := e.Finding(c.Finding.ID)
		if !ok {
			fail(w, 409, "The live finding is unavailable")
			return
		}
		c.SavedFindings = append(c.SavedFindings, e.Investigate(intel.GuessIntent(req.Question), req.Focus, req.Question, f))
	case "scenario":
		f, ok := e.Finding(c.Finding.ID)
		if !ok || len(c.Scenarios) >= 12 {
			fail(w, 409, "Live finding is unavailable or the case scenario limit was reached")
			return
		}
		switch req.Action {
		case "remove-transaction":
			ok = slices.Contains(f.Transactions, req.Target)
		case "remove-account", "disconnect-account":
			ok = slices.Contains(f.Entities, req.Target) && e.Entities[req.Target].Kind == "account"
		default:
			ok = false
		}
		if !ok {
			fail(w, 400, "Choose a valid simulation target")
			return
		}
		c.Scenarios = append(c.Scenarios, Scenario{req.Action, req.Target, e.Simulate(f, req.Action, req.Target)})
	case "status":
		switch {
		case req.Status == "In review" && c.Status == "Open":
			c.Status = req.Status
		case req.Status == "Reviewed" && c.Status == "In review" && (u.Role == "administrator" || u.Role == "senior analyst") && len(req.Text) >= 3 && len(req.Text) <= 3000:
			c.Status = req.Status
			c.Conclusion = req.Text
			c.Reviewer = u.Name
		default:
			fail(w, 400, "A senior analyst or administrator must record a conclusion after submission")
			return
		}
	default:
		fail(w, 404, "Case endpoint not found")
		return
	}
	c.Updated = time.Now().UTC()
	if err = s.store.Put(r.Context(), "bank-case-"+id, c); err != nil {
		fail(w, 500, "Case update could not be saved")
		return
	}
	s.audit(r, u, "case "+action, id)
	respond(w, 200, c)
}

func (s *Server) casePDF(c Case) ([]byte, error) {
	p := fpdf.New("P", "mm", "A4", "")
	p.SetTitle(c.Title, true)
	p.SetMargins(18, 18, 18)
	p.SetAutoPageBreak(true, 19)
	p.AddUTF8FontFromBytes("Report", "", reportRegular)
	p.AddUTF8FontFromBytes("Report", "B", reportBold)
	p.SetFooterFunc(func() {
		p.SetY(-14)
		p.SetFont("Report", "", 8)
		p.SetTextColor(100, 113, 135)
		p.CellFormat(175, 6, fmt.Sprintf("%s  /  %s   -   %d", s.brand, c.ID, p.PageNo()), "", 0, "R", false, 0, "")
	})
	p.AddPage()
	p.SetFont("Report", "B", 10)
	p.SetTextColor(28, 106, 103)
	p.CellFormat(174, 7, strings.ToUpper(s.brand)+" / INVESTIGATION REPORT", "", 1, "L", false, 0, "")
	p.SetFont("Report", "B", 25)
	p.SetTextColor(20, 28, 46)
	p.MultiCell(174, 11, c.Title, "", "L", false)
	p.SetFont("Report", "", 9)
	p.SetTextColor(100, 113, 135)
	p.MultiCell(174, 5, fmt.Sprintf("%s  /  %s  /  %s UTC", c.ID, c.Status, c.Created.Format("02 Jan 2006 15:04")), "", "L", false)
	section := func(heading, text string) {
		if p.GetY() > 259 {
			p.AddPage()
		}
		p.Ln(4)
		p.SetFont("Report", "B", 12)
		p.SetTextColor(20, 28, 46)
		p.CellFormat(174, 7, heading, "", 1, "L", false, 0, "")
		p.SetFont("Report", "", 10)
		p.SetTextColor(56, 68, 90)
		if text != "" {
			p.MultiCell(174, 5, text, "", "L", false)
		}
	}
	section("Executive summary", c.Summary.Text)
	section("Financial graph snapshot", "Highlighted edges show the transfers included in this finding. The JSON export contains the full snapshot coordinates.")
	if p.GetY() > 200 {
		p.AddPage()
	}
	y := p.GetY() + 2
	p.SetFillColor(19, 28, 45)
	p.RoundedRect(18, y, 174, 55, 2, "1234", "F")
	pos := map[string][2]float64{}
	for _, n := range c.Graph.Nodes {
		pos[n.ID] = [2]float64{105 + n.Position[0]*8, y + 27 - n.Position[1]*5}
	}
	for _, e := range c.Graph.Edges {
		a, b := pos[e.From], pos[e.To]
		if e.Highlight {
			p.SetDrawColor(246, 161, 119)
			p.SetLineWidth(.45)
		} else {
			p.SetDrawColor(61, 81, 105)
			p.SetLineWidth(.2)
		}
		p.Line(a[0], a[1], b[0], b[1])
	}
	for _, n := range c.Graph.Nodes {
		a := pos[n.ID]
		if n.ID == c.Finding.Subject {
			p.SetFillColor(246, 161, 119)
		} else {
			p.SetFillColor(123, 191, 193)
		}
		p.Circle(a[0], a[1], 1.05*n.Size, "F")
	}
	p.SetY(y + 57)
	names := []string{}
	for _, id := range c.Finding.Entities {
		for _, n := range c.Graph.Nodes {
			if n.ID == id {
				names = append(names, n.Name+" ("+n.ID+")")
				break
			}
		}
	}
	section("Important entities", strings.Join(names, ", "))
	section(fmt.Sprintf("Algorithmic finding  /  %d out of 100", c.Finding.Score), strings.Join(c.Finding.Reasons, "\n"))
	if len(c.Finding.Checks) > 0 {
		section("Rule verification", "")
		for _, check := range c.Finding.Checks {
			lines := append([]string{check.Condition}, check.Observations...)
			if len(check.References) > 0 {
				lines = append(lines, "Ledger references: "+strings.Join(check.References, ", "))
			}
			p.MultiCell(174, 5, strings.Join(lines, "\n"), "", "L", false)
			p.Ln(2)
		}
	}
	section("Verified transaction timeline", "")
	for _, step := range c.Timeline.Steps {
		p.MultiCell(174, 5, fmt.Sprintf("%s | %s UTC | %s to %s | %s %.2f", step.ID, step.Time.UTC().Format("02 Jan 15:04"), step.Sender, step.Receiver, step.Currency, step.Amount), "", "L", false)
	}
	if len(c.Evidence) > 0 {
		section("Attached ledger evidence", "")
	}
	for _, ev := range c.Evidence {
		p.MultiCell(174, 5, ev.ID+" | "+ev.Label, "", "L", false)
	}
	for _, answer := range c.SavedFindings {
		ids := []string{}
		for _, ev := range answer.Evidence {
			ids = append(ids, ev.ID)
		}
		section("Saved investigation finding / "+answer.Title, answer.Text+"\nEvidence: "+strings.Join(ids, ", "))
	}
	for _, scenario := range c.Scenarios {
		m := scenario.Comparison
		section("What-if scenario / "+scenario.Action, fmt.Sprintf("%s: %d to %d transfers, %d to %d connected components. Excluded: %s.", scenario.Target, m.Before.Transactions, m.After.Transactions, m.Before.Components, m.After.Components, strings.Join(m.Removed, ", ")))
	}
	for _, snap := range c.Snapshots {
		text := fmt.Sprintf("%s layout with %d entities and %d rendered links.", snap.Layout, len(snap.Graph.Nodes), len(snap.Graph.Edges))
		if snap.After != "" {
			text += " Start day: " + snap.After + " UTC."
		}
		if snap.Before != "" {
			text += " Historical cutoff: " + snap.Before + " UTC."
		}
		section(snap.Label, text)
	}
	for _, hypothesis := range c.Summary.Hypotheses {
		section("AI-generated hypothesis", hypothesis.Text+"\nSupporting references: "+strings.Join(hypothesis.References, ", "))
	}
	section("Hypotheses and uncertainties", "Possible explanations call for analyst review. Transfer patterns require separate evidence of ownership, intent, and the source of funds. Gross volume can include multiple transfers of the same funds.")
	for _, n := range c.Notes {
		section("Analyst note / "+n.Author, n.Text)
	}
	conclusion := c.Conclusion
	if conclusion == "" {
		conclusion = "Awaiting analyst review."
	}
	section("Analyst conclusion", conclusion)
	var output bytes.Buffer
	err := p.Output(&output)
	return output.Bytes(), err
}
