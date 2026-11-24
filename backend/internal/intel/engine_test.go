package intel

import (
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"
)

func demo(t *testing.T) *Engine {
	t.Helper()
	e, err := New(Synthetic(), nil)
	if err != nil {
		t.Fatal(err)
	}
	return e
}

func TestSyntheticDetectionsAndEvidence(t *testing.T) {
	e := demo(t)
	s := e.Summary()
	if s.Accounts != 180 || s.Entities < 200 || s.Transactions < 10000 || len(s.Buckets) != 30 {
		t.Fatalf("unexpected synthetic dataset size: %d accounts, %d entities, %d transactions, %d days", s.Accounts, s.Entities, s.Transactions, len(s.Buckets))
	}
	for _, want := range []struct{ kind, id string }{{"rapid", "ACC-001"}, {"cycle", "ACC-042"}, {"splitting", "ACC-084"}, {"burst", "ACC-124"}} {
		matched := false
		for _, f := range s.Findings {
			if f.Kind != want.kind || f.Subject != want.id {
				continue
			}
			matched = true
			for _, ev := range f.Evidence {
				if _, found := e.ByID[ev.ID]; !found || ev.Status != "verified" {
					t.Fatalf("unresolved finding evidence: %+v", ev)
				}
			}
		}
		if !matched {
			t.Errorf("expected %s finding for %s", want.kind, want.id)
		}
	}
	f := s.Findings[0]
	if f.Kind != "rapid" || len(f.Transactions) != 12 || f.End.Sub(f.Start) != 23*time.Minute {
		t.Fatalf("unexpected flagship finding: %+v", f)
	}
	for _, finding := range s.Findings {
		if len(finding.Checks) == 0 {
			t.Errorf("%s has no rule checks", finding.ID)
		}
		for _, check := range finding.Checks {
			if check.Condition == "" || len(check.Observations) == 0 {
				t.Errorf("%s has an empty rule check", finding.ID)
			}
			for _, id := range check.References {
				if !slices.ContainsFunc(finding.Evidence, func(ev Evidence) bool {
					return ev.ID == id && ev.Status == "verified" && ev.Transaction
				}) {
					t.Errorf("%s references an unavailable transaction %s", finding.ID, id)
				}
			}
		}
	}
	if answer := e.Investigate("explain", f.Subject, "", f); !reflect.DeepEqual(answer.Checks, f.Checks) {
		t.Fatal("investigator answer omitted the selected finding checks")
	}
}

func TestGraphHistoryAndLayouts(t *testing.T) {
	e := demo(t)
	f := e.Findings[0]
	graph := e.Graph(GraphOptions{Finding: f.ID, Limit: 38})
	if !reflect.DeepEqual(graph, e.Graph(GraphOptions{Finding: f.ID, Limit: 38})) {
		t.Fatal("graph query is not deterministic")
	}
	previous := e.Graph(GraphOptions{Finding: f.ID, Limit: 38, Before: f.Start.Add(-time.Second)})
	if previous.Window >= graph.Window {
		t.Fatal("historical graph includes later transactions")
	}
	for _, edge := range previous.Edges {
		if edge.Highlight {
			t.Fatal("highlighted future edge in historical graph")
		}
	}
	if len(graph.Nodes) != 38 || len(graph.Edges) > 152 {
		t.Fatal("overview query exceeds bounds")
	}
	for _, name := range []string{"Force-directed", "Hierarchical", "Geography", "Risk", "Time"} {
		other := e.Graph(GraphOptions{Finding: f.ID, Layout: name, Limit: 38})
		if reflect.DeepEqual(graph.Nodes, other.Nodes) {
			t.Errorf("layout %s had no effect", name)
		}
	}
}

func TestStoryAndSimulationIsolation(t *testing.T) {
	e := demo(t)
	f := e.Findings[0]
	story := e.Story(f)
	if story.Steps[0].Stage != "Funds enter" || story.Steps[len(story.Steps)-1].Stage != "Terminal receipt" {
		t.Fatalf("bad story ordering: %+v", story.Steps)
	}
	original := e.Graph(GraphOptions{Finding: f.ID, Limit: 38})
	s := e.Simulate(f, "remove-account", f.Subject)
	if s.After.Nodes != s.Before.Nodes-1 || s.After.Transactions >= s.Before.Transactions || !slices.Contains(s.Removed, f.Transactions[0]) {
		t.Fatalf("unexpected scenario comparison: %+v to %+v", s.Before, s.After)
	}
	for _, n := range s.Graph.Nodes {
		if n.ID == f.Subject {
			t.Fatal("removed account shown in scenario")
		}
	}
	if !reflect.DeepEqual(original, e.Graph(GraphOptions{Finding: f.ID, Limit: 38})) {
		t.Fatal("what-if modified source graph")
	}
	txo := e.Simulate(f, "remove-transaction", f.Transactions[0])
	if txo.After.Transactions+1 != txo.Before.Transactions {
		t.Fatal("exclude transfer changed more than one row")
	}
	d := e.Simulate(f, "disconnect-account", f.Subject)
	if d.After.Nodes != d.Before.Nodes || d.After.Transactions >= d.Before.Transactions {
		t.Fatal("disconnect changed node count or preserved all transfers")
	}
}

func TestInvestigatorRouteAndInference(t *testing.T) {
	e := demo(t)
	f := e.Findings[0]
	answer := e.Investigate("route", f.Subject, "Find the fastest route from ACC-002 to ACC-009", f)
	if len(answer.Evidence) < 3 || !strings.Contains(answer.Text, "earliest") {
		t.Fatalf("unexpected route: %+v", answer)
	}
	for _, m := range e.Relationships("ACC-003") {
		if m.Entity == "ACC-005" {
			if m.Status != "inferred" || m.Confidence >= 100 || len(m.Signals) < 2 {
				t.Fatalf("shared infrastructure overstated: %+v", m)
			}
			return
		}
	}
	t.Fatal("failed to find seeded shared-device relationship")
}

func TestLedgerValidationRejectsDuplicates(t *testing.T) {
	ledger := Synthetic()
	ledger.Transactions = append(ledger.Transactions, ledger.Transactions[0])
	if _, err := New(ledger, nil); err == nil {
		t.Fatal("accepted duplicate transaction")
	}
}

func TestLocalizedInvestigatorIntents(t *testing.T) {
	for question, want := range map[string]string{
		"Куда ушли деньги?":                    "flow",
		"Ақша қайда кетті?":                    "flow",
		"Найди циклические переводы":           "cycles",
		"Айналмалы аударымдарды тап":           "cycles",
		"Что изменилось за последние 24 часа?": "changes",
		"Соңғы 24 сағатта не өзгерді?":         "changes",
		"Покажи маршрут от ACC-001 до ACC-002": "route",
		"ACC-001 мен ACC-002 арасындағы бағыт": "route",
		"Қай шоттар байланысқан?":              "relationships",
		"Какие счета связаны?":                 "relationships",
		"Как дела?":                            "small-talk",
		"Как тебя зовут?":                      "identity",
		"Что ты умеешь?":                       "product-help",
		"Как загрузить CSV?":                   "import-help",
		"Как скачать отчёт в PDF?":             "report-help",
		"Сколько переводов загрузили?":         "ledger-count",
		"Сколько переводов по счёту?":          "account-count",
		"Сколько найдено аномалий?":            "finding-count",
		"Покажи переводы свыше 10 млн":         "clarify",
		"Как приготовить борщ?":                "out-of-scope",
		"Как загрузить фото в Инстаграм?":      "out-of-scope",
		"Как создать отчёт о погоде?":          "out-of-scope",
		"How are you?":              "small-talk",
		"What's the weather today?": "out-of-scope",
		"Сәлеметсіз бе!":            "greeting",
		"Файлды қалай жүктеймін?":   "import-help",
		"Интерпретируй эту сеть":    "explain",
	} {
		if got := GuessIntent(question); got != want {
			t.Errorf("GuessIntent(%q) = %q, want %q", question, got, want)
		}
	}
}
