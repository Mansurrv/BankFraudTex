package store

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"orbit/internal/intel"
)

type Projection struct {
	URL      string
	User     string
	Password string
}

func (p Projection) Rebuild(ctx context.Context, ledger intel.Ledger) error {
	if p.URL == "" {
		return nil
	}
	type statement struct {
		Cypher     string         `json:"statement"`
		Parameters map[string]any `json:"parameters,omitempty"`
	}
	rows := map[[2]string]map[string]any{}
	for _, tx := range ledger.Transactions {
		k := [2]string{tx.From, tx.To}
		if rows[k] == nil {
			rows[k] = map[string]any{"from": tx.From, "to": tx.To, "count": 0, "usd": 0.0}
		}
		rows[k]["count"] = rows[k]["count"].(int) + 1
		rows[k]["usd"] = rows[k]["usd"].(float64) + tx.USD
	}
	flows := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		flows = append(flows, row)
	}
	st := []statement{
		{Cypher: "MATCH (n:OrbitEntity) DETACH DELETE n"},
		{Cypher: "UNWIND $rows AS item CREATE (:OrbitEntity {id:item.id, name:item.name, kind:item.kind, community:item.community})", Parameters: map[string]any{"rows": ledger.Entities}},
		{Cypher: "UNWIND $rows AS item MATCH (a:OrbitEntity {id:item.from}),(b:OrbitEntity {id:item.to}) CREATE (a)-[:CONFIRMED {id:item.id, kind:item.kind}]->(b)", Parameters: map[string]any{"rows": ledger.Links}},
		{Cypher: "UNWIND $rows AS item MATCH (a:OrbitEntity {id:item.from}),(b:OrbitEntity {id:item.to}) CREATE (a)-[:FLOW {count:item.count, usd:item.usd}]->(b)", Parameters: map[string]any{"rows": flows}},
	}
	body, err := json.Marshal(map[string]any{"statements": st})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(p.URL, "/")+"/db/neo4j/tx/commit", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.SetBasicAuth(p.User, p.Password)
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 18 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var report struct{ Errors []struct{ Message string } }
	if err = json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Neo4j HTTP %d", resp.StatusCode)
	}
	if len(report.Errors) > 0 {
		return fmt.Errorf("Neo4j projection: %s", report.Errors[0].Message)
	}
	return nil
}
