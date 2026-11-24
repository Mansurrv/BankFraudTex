package intel

import (
	"fmt"
	"slices"
	"testing"
	"time"
)

func TestSyntheticMuleFinding(t *testing.T) {
	e := demo(t)
	f, ok := e.Finding("mule-ACC-148")
	if !ok {
		t.Fatal("missing synthetic money mule finding")
	}
	if len(f.Transactions) != 14 || len(f.Evidence) != 14 {
		t.Fatalf("expected two complete episodes with three shared routes: %+v", f)
	}
	stages := map[string]int{}
	for _, step := range e.Story(f).Steps {
		stages[step.Stage]++
	}
	if stages["Funds enter"] != 2 || stages["Funds fan out"] != 6 || stages["Rapid onward transfer"] != 6 {
		t.Fatalf("unexpected story stages: %+v", stages)
	}
	graph := e.Graph(GraphOptions{Finding: f.ID, Limit: 38})
	for _, id := range f.Transactions {
		if !slices.ContainsFunc(graph.Edges, func(edge Edge) bool {
			return edge.Highlight && slices.Contains(edge.Transactions, id)
		}) {
			t.Errorf("graph is missing highlighted evidence %s", id)
		}
	}
}

func TestMuleDetectionRequiresRepeatedFastFundedRoutes(t *testing.T) {
	at := DemoStart.Add(5 * time.Hour)
	var base Ledger
	for _, id := range []string{"origin", "hub", "relay-a", "relay-b", "sink", "other-sink"} {
		base.Entities = append(base.Entities, Entity{ID: id, Name: id, Kind: "account"})
	}
	for episode := 0; episode < 2; episode++ {
		start := at.Add(time.Duration(episode) * 24 * time.Hour)
		for i, leg := range []struct {
			from, to string
			usd      float64
			minute   time.Duration
		}{
			{"origin", "hub", 10000, 0},
			{"hub", "relay-a", 4900, 2},
			{"hub", "relay-b", 4800, 3},
			{"relay-a", "sink", 4750, 10},
			{"relay-b", "sink", 4700, 13},
		} {
			base.Transactions = append(base.Transactions, Transaction{
				ID: fmt.Sprintf("%d-%d", episode, i), From: leg.from, To: leg.to,
				Amount: leg.usd, USD: leg.usd, Currency: "USD", Kind: "wire",
				Time: start.Add(leg.minute * time.Minute),
			})
		}
	}

	for _, tc := range []struct {
		name   string
		alter  func([]Transaction) []Transaction
		detect bool
	}{
		{"two episodes", nil, true},
		{"single episode", func(txs []Transaction) []Transaction { return txs[:5] }, false},
		{"missing inbound credit", func(txs []Transaction) []Transaction { return txs[1:] }, false},
		{"different route", func(txs []Transaction) []Transaction { txs[9].To = "other-sink"; return txs }, false},
		{"slow onward leg", func(txs []Transaction) []Transaction {
			txs[9].Time = txs[7].Time.Add(muleWindow + time.Second)
			return txs
		}, false},
		{"unclear ordering", func(txs []Transaction) []Transaction { txs[9].Time = txs[7].Time; return txs }, false},
		{"small onward amount", func(txs []Transaction) []Transaction { txs[9].USD, txs[9].Amount = 100, 100; return txs }, false},
		{"insufficient credit", func(txs []Transaction) []Transaction { txs[5].USD, txs[5].Amount = 4000, 4000; return txs }, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ledger := base
			ledger.Transactions = slices.Clone(base.Transactions)
			if tc.alter != nil {
				ledger.Transactions = tc.alter(ledger.Transactions)
			}
			e, err := New(ledger, nil)
			if err != nil {
				t.Fatal(err)
			}
			f, found := e.Finding("mule-hub")
			if found != tc.detect {
				t.Fatalf("mule finding present = %t, want %t: %+v", found, tc.detect, f)
			}
			if found && len(f.Evidence) != 10 {
				t.Fatalf("unexpected evidence count: %+v", f.Evidence)
			}
		})
	}
}
