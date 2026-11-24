package api

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"orbit/internal/intel"
)

const batchLimit = 2000

var bankID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,39}$`)

type invalidLedger struct{ error }

type bankImport struct {
	Transactions []intel.Transaction `json:"transactions"`
	CSV          *string             `json:"csv"`
}

func (s *Server) ingest(w http.ResponseWriter, r *http.Request, u User) {
	if u.Role == "auditor" {
		fail(w, 403, "Auditor access is read-only")
		return
	}

	var batch bankImport
	if !body(w, r, &batch, 8<<20) {
		return
	}
	if batch.CSV != nil {
		if batch.Transactions != nil {
			fail(w, 400, "Submit either CSV or JSON transactions")
			return
		}
		var err error
		batch.Transactions, err = readBankCSV(*batch.CSV)
		if err != nil {
			fail(w, 400, err.Error())
			return
		}
	}
	if len(batch.Transactions) < 1 || len(batch.Transactions) > batchLimit {
		fail(w, 400, "An import must contain 1–2,000 transactions")
		return
	}
	for idx, tx := range batch.Transactions {
		if !bankID.MatchString(tx.ID) || !bankID.MatchString(tx.From) || !bankID.MatchString(tx.To) {
			fail(w, 400, fmt.Sprintf("Record %d has an invalid transaction or account ID", idx+1))
			return
		}
		tx.Currency = strings.ToUpper(strings.TrimSpace(tx.Currency))
		tx.Kind = strings.TrimSpace(tx.Kind)
		tx.Time = tx.Time.UTC()
		if tx.Currency == "USD" && tx.USD == 0 {
			tx.USD = tx.Amount
		}
		batch.Transactions[idx] = tx
	}

	s.writes.Lock()
	defer s.writes.Unlock()
	current := s.ledger.Load()
	ledger := current.Ledger
	ledger.Transactions = append([]intel.Transaction(nil), ledger.Transactions...)
	ledger.Entities = append([]intel.Entity(nil), ledger.Entities...)
	seen := make(map[string]intel.Transaction, len(batch.Transactions))
	addedAccounts := map[string]bool{}
	for _, tx := range batch.Transactions {
		old, exists := seen[tx.ID]
		if !exists {
			old, exists = current.ByID[tx.ID]
		}
		if exists {
			if old != tx {
				fail(w, 409, fmt.Sprintf("Transaction %q already exists with different details", tx.ID))
				return
			}
			continue
		}
		seen[tx.ID] = tx
		for _, id := range []string{tx.From, tx.To} {
			if _, exists := current.Entities[id]; !exists && !addedAccounts[id] {
				ledger.Entities = append(ledger.Entities, intel.Entity{ID: id, Name: id, Kind: "account"})
				addedAccounts[id] = true
			}
		}
		ledger.Transactions = append(ledger.Transactions, tx)
	}
	if len(ledger.Transactions) > 50000 {
		fail(w, 400, "Ledger capacity is 50,000 transactions")
		return
	}
	if len(seen) > 0 {
		if err := s.install(r.Context(), ledger, true); err != nil {
			var validation invalidLedger
			if errors.As(err, &validation) {
				fail(w, 400, validation.Error())
			} else {
				s.logger.Error("bank import failed", "error", err)
				fail(w, 500, "Unable to persist import")
			}
			return
		}
		s.audit(r, u, "import bank transactions", strconv.Itoa(len(seen)))
	}
	respond(w, 201, map[string]any{"added": len(seen), "summary": s.ledger.Load().Summary()})
}

func readBankCSV(content string) ([]intel.Transaction, error) {
	reader := csv.NewReader(strings.NewReader(strings.TrimPrefix(content, "\ufeff")))
	reader.TrimLeadingSpace = true
	header, err := reader.Read()
	if err != nil {
		return nil, errors.New("CSV must include a header and transaction rows")
	}
	index := map[string]int{}
	for col, value := range header {
		key := strings.ToLower(strings.TrimSpace(value))
		if _, exists := index[key]; exists {
			return nil, fmt.Errorf("Duplicate CSV column %q", key)
		}
		index[key] = col
	}
	for _, key := range []string{"id", "from", "to", "amount", "currency", "kind", "time"} {
		if _, exists := index[key]; !exists {
			return nil, fmt.Errorf("Missing CSV column %q", key)
		}
	}
	transactions := []intel.Transaction{}
	for {
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			return transactions, nil
		}
		row := len(transactions) + 2
		if err != nil {
			return nil, fmt.Errorf("Invalid CSV record %d", row)
		}
		if len(transactions) >= batchLimit {
			return nil, errors.New("An import must contain 1–2,000 transactions")
		}
		value := func(key string) string { return strings.TrimSpace(record[index[key]]) }
		amount, amountErr := strconv.ParseFloat(value("amount"), 64)
		at, timeErr := time.Parse(time.RFC3339, value("time"))
		var usd float64
		var usdErr error
		if _, exists := index["usd"]; exists && value("usd") != "" {
			usd, usdErr = strconv.ParseFloat(value("usd"), 64)
		}
		if amountErr != nil || usdErr != nil || timeErr != nil {
			return nil, fmt.Errorf("Invalid amount, USD equivalent, or timestamp on CSV record %d", row)
		}
		transactions = append(transactions, intel.Transaction{
			ID: value("id"), From: value("from"), To: value("to"), Amount: amount,
			Currency: value("currency"), USD: usd, Kind: value("kind"), Time: at,
		})
	}
}
