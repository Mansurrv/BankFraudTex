package intel

import (
	"fmt"
	"math"
	"slices"
	"sort"
	"strings"
	"time"
)

type StoryStep struct {
	Transaction
	Sender   string `json:"sender"`
	Receiver string `json:"receiver"`
	Elapsed  int    `json:"elapsed"`
	Stage    string `json:"stage"`
}

type Story struct {
	Title   string      `json:"title"`
	Summary string      `json:"summary"`
	Steps   []StoryStep `json:"steps"`
}

func (e *Engine) Story(f Finding) Story {
	s := Story{Title: f.Title, Summary: f.Summary, Steps: []StoryStep{}}
	var previous time.Time
	out := map[string]int{}
	in := map[string]int{}
	for _, id := range f.Transactions {
		t := e.ByID[id]
		out[t.From]++
		in[t.To]++
	}
	for _, id := range f.Transactions {
		t, ok := e.ByID[id]
		if !ok {
			continue
		}
		x := StoryStep{Transaction: t, Sender: e.Entities[t.From].Name, Receiver: e.Entities[t.To].Name, Stage: "Intermediary transfer"}
		switch {
		case f.Kind == "cycle" && t.To == f.Subject:
			x.Stage = "Loop closes"
		case f.Kind == "cycle" && len(s.Steps) == 0:
			x.Stage = "Opening transfer"
		case t.To == f.Subject:
			x.Stage = "Funds enter"
		case t.From == f.Subject && out[t.From] > 1:
			x.Stage = "Funds fan out"
		case f.Kind == "mule":
			x.Stage = "Rapid onward transfer"
		case out[t.To] == 0:
			x.Stage = "Terminal receipt"
		case in[t.To] > 1:
			x.Stage = "Routes converge"
		case f.Kind == "cycle":
			x.Stage = "Circular transfer"
		}
		if !previous.IsZero() {
			x.Elapsed = int(t.Time.Sub(previous).Seconds())
		}
		s.Steps = append(s.Steps, x)
		previous = t.Time
	}
	return s
}

type Period struct {
	Start          time.Time `json:"start"`
	End            time.Time `json:"end"`
	Count          int       `json:"count"`
	USD            float64   `json:"usd"`
	Counterparties int       `json:"counterparties"`
}

type Forecast struct {
	NextDay int    `json:"nextDay"`
	Low     int    `json:"low"`
	High    int    `json:"high"`
	Method  string `json:"method"`
}

type Temporal struct {
	Before   Period     `json:"before"`
	After    Period     `json:"after"`
	Change   float64    `json:"change"`
	Forecast Forecast   `json:"forecast"`
	Evidence []Evidence `json:"evidence"`
}

func (e *Engine) Temporal(id string, end time.Time, hours int) Temporal {
	if end.IsZero() {
		end = e.End
	}
	hours = min(168, max(1, hours))
	gap := time.Duration(hours) * time.Hour
	tx := e.Ledger.Transactions
	if id != "" {
		tx = e.ByAccount[id]
	}
	result := Temporal{Before: Period{Start: end.Add(-2 * gap), End: end.Add(-gap)}, After: Period{Start: end.Add(-gap), End: end}, Evidence: []Evidence{}}
	peers := map[string]bool{}
	oldPeers := map[string]bool{}
	for _, t := range tx {
		if t.Time.After(end) || !t.Time.After(result.Before.Start) {
			continue
		}
		if t.Time.After(result.After.Start) {
			result.After.Count++
			result.After.USD += t.USD
			for _, n := range []string{t.From, t.To} {
				if n != id {
					peers[n] = true
				}
			}
			if len(result.Evidence) < 6 {
				result.Evidence = append(result.Evidence, e.TxEvidence(t))
			}
		} else {
			result.Before.Count++
			result.Before.USD += t.USD
			for _, n := range []string{t.From, t.To} {
				if n != id {
					oldPeers[n] = true
				}
			}
		}
	}
	result.After.Counterparties = len(peers)
	result.Before.Counterparties = len(oldPeers)
	if result.Before.Count > 0 {
		result.Change = 100 * float64(result.After.Count-result.Before.Count) / float64(result.Before.Count)
	}
	daily := make([]float64, 7)
	for _, t := range tx {
		age := end.Sub(t.Time)
		if age >= 0 && age < 7*24*time.Hour {
			daily[6-int(age/(24*time.Hour))]++
		}
	}
	prediction := daily[0]
	var errorSum float64
	for _, n := range daily[1:] {
		errorSum += math.Pow(n-prediction, 2)
		prediction = .35*n + .65*prediction
	}
	spread := 1.65 * math.Sqrt(errorSum/6)
	result.Forecast = Forecast{NextDay: int(math.Round(prediction)), Low: max(0, int(math.Floor(prediction-spread))), High: int(math.Ceil(prediction + spread)), Method: "Seven-day exponential smoothing with an empirical residual range"}
	return result
}

type SimulationMetrics struct {
	Nodes        int     `json:"nodes"`
	Transactions int     `json:"transactions"`
	USD          float64 `json:"usd"`
	Components   int     `json:"components"`
	Largest      int     `json:"largest"`
}

type Simulation struct {
	Before      SimulationMetrics `json:"before"`
	After       SimulationMetrics `json:"after"`
	Graph       Graph             `json:"graph"`
	Removed     []string          `json:"removed"`
	Alternative []StoryStep       `json:"alternative"`
	Critical    []Evidence        `json:"critical"`
}

func (e *Engine) Simulate(f Finding, action, target string) Simulation {
	o := GraphOptions{Finding: f.ID, Limit: max(35, len(f.Entities)), Layout: "Communities"}
	switch action {
	case "remove-account":
		o.Remove = target
	case "remove-transaction":
		o.RemoveTx = target
	case "disconnect-account":
		o.Disconnect = target
	}
	metrics := func(opts GraphOptions) (SimulationMetrics, []string) {
		m := SimulationMetrics{}
		removed := []string{}
		adj := map[string][]string{}
		for _, id := range f.Entities {
			if id != opts.Remove {
				adj[id] = []string{}
			}
		}
		for _, id := range f.Transactions {
			t := e.ByID[id]
			if id == opts.RemoveTx || slices.Contains([]string{t.From, t.To}, opts.Remove) || slices.Contains([]string{t.From, t.To}, opts.Disconnect) {
				removed = append(removed, id)
				continue
			}
			m.Transactions++
			m.USD += t.USD
			adj[t.From] = append(adj[t.From], t.To)
			adj[t.To] = append(adj[t.To], t.From)
		}
		m.Nodes = len(adj)
		seen := map[string]bool{}
		for id := range adj {
			if seen[id] {
				continue
			}
			m.Components++
			queue := []string{id}
			seen[id] = true
			for i := 0; i < len(queue); i++ {
				for _, peer := range adj[queue[i]] {
					if !seen[peer] {
						seen[peer] = true
						queue = append(queue, peer)
					}
				}
			}
			m.Largest = max(m.Largest, len(queue))
		}
		return m, removed
	}
	before, _ := metrics(GraphOptions{})
	after, removed := metrics(o)
	alternative := []StoryStep{}
	critical := []Evidence{}
	if len(f.Transactions) > 1 {
		first := e.ByID[f.Transactions[0]]
		last := e.ByID[f.Transactions[len(f.Transactions)-1]]
		excluded := map[string]bool{}
		for _, r := range removed {
			excluded[r] = true
		}
		txs := []Transaction{}
		for _, id := range f.Transactions {
			if !excluded[id] {
				txs = append(txs, e.ByID[id])
			}
		}
		if first.From != last.To {
			route := earliest(txs, first.From, last.To, first.Time.Add(-time.Second), last.Time)
			ids := []string{}
			for _, t := range route {
				ids = append(ids, t.ID)
			}
			alternative = e.Story(Finding{Subject: f.Subject, Transactions: ids}).Steps
		}
		for _, id := range f.Entities {
			trial, _ := metrics(GraphOptions{Remove: id})
			if trial.Components > before.Components {
				critical = append(critical, Evidence{ID: id, Label: e.Entities[id].Name + " · bridge between components", Status: "algorithmic", Focus: id})
			}
		}
	}
	return Simulation{Before: before, After: after, Graph: e.Graph(o), Removed: removed, Alternative: alternative, Critical: critical}
}

func earliest(txs []Transaction, from, to string, start, end time.Time) []Transaction {
	arrivals := map[string]time.Time{from: start}
	paths := map[string][]Transaction{from: {}}
	for _, t := range txs {
		if t.Time.After(end) {
			break
		}
		if t.Time.Before(start) {
			continue
		}
		at, ok := arrivals[t.From]
		if !ok || t.Time.Before(at) || len(paths[t.From]) >= 10 {
			continue
		}
		if _, seen := arrivals[t.To]; seen {
			continue
		}
		arrivals[t.To] = t.Time
		paths[t.To] = append(append([]Transaction{}, paths[t.From]...), t)
		if t.To == to {
			return paths[to]
		}
	}
	return []Transaction{}
}

type Hypothesis struct {
	Text       string   `json:"text"`
	References []string `json:"references"`
}

type Answer struct {
	ID          string         `json:"id,omitempty"`
	Hypotheses  []Hypothesis   `json:"hypotheses,omitempty"`
	Intent      string         `json:"intent"`
	Title       string         `json:"title"`
	Text        string         `json:"text"`
	Kind        string         `json:"kind"`
	Evidence    []Evidence     `json:"evidence"`
	Checks      []FindingCheck `json:"checks,omitempty"`
	Limitations []string       `json:"limitations"`
}

var Intents = []string{"explain", "flow", "important", "cycles", "route", "changes", "risk", "report", "relationships"}

func (e *Engine) Investigate(intent, focus, question string, f Finding) Answer {
	if text, ok := assistantReplies[intent]; ok {
		return Answer{Intent: intent, Kind: "assistant", Text: text, Evidence: []Evidence{}, Limitations: []string{}}
	}
	answer := Answer{Intent: intent, Title: "Network explanation", Kind: "algorithmic", Evidence: []Evidence{}, Limitations: []string{"Transfer sequences support review. Intent and source of funds require separate evidence."}}
	if focus == "" {
		focus = f.Subject
	}
	name := e.Entities[focus].Name
	switch intent {
	case "ledger-count":
		answer.Title = "Ledger totals"
		answer.Text = fmt.Sprintf("The ledger contains %d transactions across %d accounts.", len(e.ByID), len(e.Features))
	case "account-count":
		answer.Title = "Account totals"
		detail, ok := e.Detail(focus)
		if !ok {
			return e.Investigate("clarify", "", "", Finding{})
		}
		answer.Text = fmt.Sprintf("%s has %d recorded transfers across %d counterparties, with USD-equivalent %s inbound and %s outbound.", name, detail.Count, detail.Counterparties, formatMoney(detail.Inflow), formatMoney(detail.Outflow))
		for _, tx := range detail.Transactions[:min(5, len(detail.Transactions))] {
			answer.Evidence = append(answer.Evidence, e.TxEvidence(tx))
		}
	case "finding-count":
		answer.Title = "Flagged patterns"
		answer.Text = fmt.Sprintf("FFBI has flagged %d patterns in the imported ledger. Open Anomaly Radar to review them.", len(e.Findings))
	case "cycles":
		answer.Title = "Circular transfer review"
		for _, candidate := range e.Findings {
			if candidate.Kind == "cycle" && (len(f.Entities) == 0 || slices.Contains(f.Entities, candidate.Subject)) {
				answer.Text = candidate.Summary
				answer.Evidence = candidate.Evidence
				return answer
			}
		}
		answer.Text = "The cycle tool found no qualifying time-ordered circular sequence in this scope. It checks two to five high-value transfers within two hours."
	case "route":
		answer.Title = "Earliest-arrival transfer route"
		positions := map[string]int{}
		q := strings.ToLower(question)
		for id, node := range e.Entities {
			for _, needle := range []string{strings.ToLower(id), strings.ToLower(node.Name)} {
				if index := strings.Index(q, needle); index >= 0 {
					if old, ok := positions[id]; !ok || index < old {
						positions[id] = index
					}
				}
			}
		}
		ids := []string{}
		for id := range positions {
			ids = append(ids, id)
		}
		sort.Slice(ids, func(i, j int) bool {
			if positions[ids[i]] == positions[ids[j]] {
				return ids[i] < ids[j]
			}
			return positions[ids[i]] < positions[ids[j]]
		})
		if len(ids) < 2 {
			answer.Text = "Name two accounts or include their IDs, in sender-to-receiver order."
			return answer
		}
		start, end := e.Start, e.End
		if !f.Start.IsZero() {
			start, end = f.Start, f.End
		}
		path := earliest(e.Ledger.Transactions, ids[0], ids[1], start, end)
		answer.Text = fmt.Sprintf("No qualifying time-ordered route from %s to %s in this window.", e.Entities[ids[0]].Name, e.Entities[ids[1]].Name)
		if len(path) > 0 {
			answer.Text = fmt.Sprintf("The earliest observed route from %s to %s has %d transfer(s). It starts at %s UTC and arrives at %s UTC.", e.Entities[ids[0]].Name, e.Entities[ids[1]].Name, len(path), path[0].Time.UTC().Format("02 Jan 15:04"), path[len(path)-1].Time.UTC().Format("02 Jan 15:04"))
			for _, t := range path {
				answer.Evidence = append(answer.Evidence, e.TxEvidence(t))
			}
		}
	case "changes":
		answer.Title = "Change over the last 24 hours"
		t := e.Temporal(focus, e.End, 24)
		answer.Text = fmt.Sprintf("The latest 24-hour period recorded %d transfers and USD-equivalent %s in gross volume. The preceding period recorded %d transfers and USD-equivalent %s.", t.After.Count, formatMoney(t.After.USD), t.Before.Count, formatMoney(t.Before.USD))
		answer.Evidence = t.Evidence
	case "risk":
		answer.Title = "Observable risk indicators"
		if f.Subject != focus {
			f = Finding{}
			for _, candidate := range e.Findings {
				if candidate.Subject == focus {
					f = candidate
					break
				}
			}
		}
		if f.ID == "" {
			answer.Text = "There is no scored anomaly for this selection under the current detection rules."
			return answer
		}
		answer.Text = fmt.Sprintf("%s scored %d/100 for %s. %s.", name, f.Score, strings.ToLower(f.Title), strings.Join(f.Reasons, ". "))
		answer.Checks = f.Checks
		answer.Evidence = f.Evidence
	case "relationships":
		answer.Title = "Relationship evidence"
		relationships := e.Relationships(focus)
		for _, r := range relationships[:min(7, len(relationships))] {
			answer.Evidence = append(answer.Evidence, r.Signals...)
		}
		answer.Text = fmt.Sprintf("The relationship search returned %d candidates for %s. Confirmed ledger links and inferred signals are labeled separately. Shared infrastructure supports review of a possible connection.", len(relationships), name)
	case "flow", "important", "report", "explain":
		if f.ID == "" {
			if detail, ok := e.Detail(focus); ok {
				answer.Text = fmt.Sprintf("%s has %d recorded transfers across %d counterparties, with USD-equivalent %s inbound and %s outbound.", name, detail.Count, detail.Counterparties, formatMoney(detail.Inflow), formatMoney(detail.Outflow))
				for _, tx := range detail.Transactions[:min(5, len(detail.Transactions))] {
					answer.Evidence = append(answer.Evidence, e.TxEvidence(tx))
				}
			} else {
				answer.Text = "Select an account or a finding to investigate a bounded set of records."
			}
			return answer
		}
		answer.Evidence = f.Evidence
		switch intent {
		case "flow":
			answer.Title = "Observed money flow"
			var terminal []string
			for _, s := range e.Story(f).Steps {
				if s.Stage == "Terminal receipt" || s.Stage == "Loop closes" || s.Stage == "Rapid onward transfer" {
					terminal = append(terminal, fmt.Sprintf("%s received %s %s", s.Receiver, s.Currency, formatMoney(s.Amount)))
				}
			}
			answer.Text = f.Summary
			if len(terminal) > 0 {
				answer.Text += " Observed endpoint receipts include " + strings.Join(terminal[:min(3, len(terminal))], "; ") + "."
			}
		case "important":
			answer.Title = "Most connected account in this finding"
			degree := map[string]int{}
			for _, t := range e.Story(f).Steps {
				degree[t.From]++
				degree[t.To]++
			}
			keys := []string{}
			for id := range degree {
				keys = append(keys, id)
			}
			sort.Slice(keys, func(i, j int) bool {
				if degree[keys[i]] == degree[keys[j]] {
					return keys[i] < keys[j]
				}
				return degree[keys[i]] > degree[keys[j]]
			})
			if len(keys) > 0 {
				id := keys[0]
				answer.Text = fmt.Sprintf("%s is incident to %d of the %d observed transfers in this finding.", e.Entities[id].Name, degree[id], len(f.Transactions))
				answer.Evidence = append([]Evidence{{ID: id, Focus: id, Label: e.Entities[id].Name, Status: "algorithmic"}}, f.Evidence...)
			}
		default:
			answer.Checks = f.Checks
			if intent == "report" {
				answer.Title = "Investigation summary"
			}
			answer.Text = fmt.Sprintf("%s The evidence covers %d transfers involving %d entities over %d minutes, with USD-equivalent %s in gross transfer volume.", f.Summary, len(f.Transactions), len(f.Entities), int(math.Ceil(f.End.Sub(f.Start).Minutes())), formatMoney(f.USD))
			if len(f.Transactions) > 0 {
				var hypothesis string
				switch f.Kind {
				case "rapid":
					hypothesis = "The tightly timed fan-out could reflect a scheduled settlement or a deliberate routing arrangement. Compare the transfer cadence with the account's operating records."
				case "mule":
					hypothesis = "A recurring payout arrangement could produce these routes. Compare account ownership, payment instructions, and cash-out records with the linked transfers."
				case "cycle":
					hypothesis = "Reconciliation or treasury operations could account for the observed return to the opening account. Review the transfer references against the related instructions."
				case "splitting":
					hypothesis = "A payment batch could account for the similar amounts. Compare invoices and payment instructions before inferring why the amounts were chosen."
				}
				if hypothesis != "" {
					answer.Hypotheses = []Hypothesis{{Text: hypothesis, References: append([]string{}, f.Transactions[:min(3, len(f.Transactions))]...)}}
				}
			}
		}
	}
	return answer
}
