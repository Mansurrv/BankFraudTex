package intel

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

const LedgerVersion = "ffbi-ledger-v1"

type Engine struct {
	Ledger     Ledger
	Entities   map[string]Entity
	ByID       map[string]Transaction
	ByAccount  map[string][]Transaction
	Findings   []Finding
	Features   map[string]Fingerprint
	Scores     map[string]int
	Model      string
	Discovered []Community
	Start      time.Time
	End        time.Time
}

func New(ledger Ledger, score func(map[string]Fingerprint) map[string]float64) (*Engine, error) {
	e := &Engine{Ledger: ledger, Entities: map[string]Entity{}, ByID: map[string]Transaction{}, ByAccount: map[string][]Transaction{}, Scores: map[string]int{}, Model: "Robust statistical baseline"}
	for _, node := range ledger.Entities {
		if _, exists := e.Entities[node.ID]; exists || node.ID == "" {
			return nil, errors.New("duplicate or missing entity ID")
		}
		e.Entities[node.ID] = node
	}
	e.Ledger.Transactions = append([]Transaction(nil), ledger.Transactions...)
	sort.Slice(e.Ledger.Transactions, func(i, j int) bool {
		a, b := e.Ledger.Transactions[i], e.Ledger.Transactions[j]
		if a.Time.Equal(b.Time) {
			return a.ID < b.ID
		}
		return a.Time.Before(b.Time)
	})
	for _, tx := range e.Ledger.Transactions {
		if err := e.validateTx(tx); err != nil {
			return nil, err
		}
		e.ByID[tx.ID] = tx
		e.ByAccount[tx.From] = append(e.ByAccount[tx.From], tx)
		e.ByAccount[tx.To] = append(e.ByAccount[tx.To], tx)
	}
	links := map[string]bool{}
	for _, link := range ledger.Links {
		if link.ID == "" || links[link.ID] || e.Entities[link.From].ID == "" || e.Entities[link.To].ID == "" || link.From == link.To || link.Status != "verified" {
			return nil, fmt.Errorf("invalid confirmed relationship %q", link.ID)
		}
		links[link.ID] = true
	}
	if len(e.Ledger.Transactions) > 0 {
		e.Start = e.Ledger.Transactions[0].Time.UTC().Truncate(24 * time.Hour)
		e.End = e.Ledger.Transactions[len(e.Ledger.Transactions)-1].Time.UTC().Truncate(24 * time.Hour).Add(24*time.Hour - time.Second)
	}
	e.Features = e.fingerprints()
	var ml map[string]float64
	if score != nil && len(e.Features) > 0 {
		ml = score(e.Features)
	}
	if len(ml) > 0 {
		e.Model = "Isolation Forest + robust statistics"
	}
	e.Findings = e.detect(ml)
	for _, f := range e.Findings {
		if f.Score > e.Scores[f.Subject] {
			e.Scores[f.Subject] = f.Score
		}
	}
	return e, nil
}

func (e *Engine) validateTx(tx Transaction) error {
	_, duplicate := e.ByID[tx.ID]
	validCurrency := tx.Currency == "USD" || tx.Currency == "EUR" || tx.Currency == "GBP" || tx.Currency == "KZT" || tx.Currency == "SGD"
	if duplicate || len(tx.ID) < 1 || len(tx.ID) > 40 || e.Entities[tx.From].Kind != "account" || e.Entities[tx.To].Kind != "account" || tx.From == tx.To || tx.Amount <= 0 || tx.USD <= 0 || math.IsNaN(tx.USD+tx.Amount) || math.IsInf(tx.USD+tx.Amount, 0) || tx.USD > 1e12 || tx.Amount > 1e15 || !validCurrency || len(tx.Kind) < 1 || len(tx.Kind) > 40 || tx.Time.Year() < 2000 || tx.Time.Year() > 2100 {
		return fmt.Errorf("invalid transaction %q", tx.ID)
	}
	return nil
}

func (e *Engine) Summary() Summary {
	days := 0
	if len(e.Ledger.Transactions) > 0 {
		days = int(e.End.Sub(e.Start)/(24*time.Hour)) + 1
	}
	// Bound the overview series to the latest 365 days for larger imports.
	days = min(days, 365)
	start := e.End.Truncate(24*time.Hour).AddDate(0, 0, 1-days)
	s := Summary{Version: LedgerVersion, Start: e.Start, End: e.End, Entities: len(e.Entities), Transactions: len(e.ByID), Findings: e.Findings, Model: e.Model, Buckets: make([]Bucket, days)}
	groups := map[string]bool{}
	for _, n := range e.Entities {
		if n.Kind == "account" {
			s.Accounts++
		}
		groups[n.Community] = true
	}
	s.Communities = len(groups)
	for i := range s.Buckets {
		s.Buckets[i].Date = start.AddDate(0, 0, i).Format(time.DateOnly)
	}
	for _, t := range e.Ledger.Transactions {
		s.USD += t.USD
		if !t.Time.Before(start) {
			i := int(t.Time.Sub(start) / (24 * time.Hour))
			s.Buckets[i].Count++
			s.Buckets[i].USD += t.USD
		}
	}
	return s
}

func (e *Engine) Finding(id string) (Finding, bool) {
	for _, f := range e.Findings {
		if f.ID == id {
			return f, true
		}
	}
	return Finding{}, false
}

func (e *Engine) Search(query string, limit int) []Entity {
	query = strings.ToLower(strings.TrimSpace(query))
	nodes := []Entity{}
	for _, node := range e.Ledger.Entities {
		if strings.Contains(strings.ToLower(node.ID+" "+node.Name+" "+node.Community+" "+node.Kind), query) {
			node.Score = e.Scores[node.ID]
			nodes = append(nodes, node)
		}
	}
	sort.Slice(nodes, func(i, j int) bool {
		a, b := nodes[i], nodes[j]
		if strings.EqualFold(a.ID, query) || strings.EqualFold(b.ID, query) {
			return strings.EqualFold(a.ID, query)
		}
		if a.Score != b.Score {
			return a.Score > b.Score
		}
		return a.ID < b.ID
	})
	return nodes[:min(len(nodes), limit)]
}

func (e *Engine) TxEvidence(tx Transaction) Evidence {
	return Evidence{
		ID: tx.ID, Status: "verified", Focus: tx.To, Transaction: true,
		Label: fmt.Sprintf("%s to %s · %s %s · %s UTC", e.Entities[tx.From].Name, e.Entities[tx.To].Name, tx.Currency, formatMoney(tx.Amount), tx.Time.UTC().Format("02 Jan 15:04")),
	}
}
