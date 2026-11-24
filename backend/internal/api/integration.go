package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"sort"
	"strings"
	"time"

	"orbit/internal/intel"
)

type Analytics struct{ URL string }

func (a Analytics) post(ctx context.Context, route string, input, out any, timeout time.Duration) error {
	if a.URL == "" {
		return fmt.Errorf("analytics service disabled")
	}
	body, err := json.Marshal(input)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(a.URL, "/")+route, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: timeout}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("analytics HTTP %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (a Analytics) Score(ctx context.Context, f map[string]intel.Fingerprint) map[string]float64 {
	if a.URL == "" {
		return nil
	}
	var result struct{ Scores map[string]float64 }
	if a.post(ctx, "/score", map[string]any{"fingerprints": f, "names": intel.FeatureNames}, &result, 6*time.Second) != nil {
		return nil
	}
	return result.Scores
}

func (a Analytics) Intent(ctx context.Context, question string) string {
	local := intel.GuessIntent(question)
	if !slices.Contains(intel.Intents, local) {
		return local
	}
	var result struct{ Intent string }
	err := a.post(ctx, "/intent", map[string]string{"question": question}, &result, 5*time.Second)
	if err == nil && slices.Contains(intel.Intents, result.Intent) {
		return result.Intent
	}
	return local
}

func (a Analytics) Communities(ctx context.Context, e *intel.Engine) []intel.Community {
	if a.URL == "" {
		return nil
	}
	type flow struct {
		Sender   string `json:"sender"`
		Receiver string `json:"receiver"`
		Count    int    `json:"count"`
	}
	counts := map[[2]string]int{}
	accounts := []string{}
	for id := range e.Features {
		accounts = append(accounts, id)
	}
	sort.Strings(accounts)
	for _, t := range e.Ledger.Transactions {
		counts[[2]string{t.From, t.To}]++
	}
	pairs := make([]flow, 0, len(counts))
	for key, count := range counts {
		pairs = append(pairs, flow{key[0], key[1], count})
	}
	sort.Slice(pairs, func(i, j int) bool {
		if pairs[i].Sender == pairs[j].Sender {
			return pairs[i].Receiver < pairs[j].Receiver
		}
		return pairs[i].Sender < pairs[j].Sender
	})
	var result struct{ Groups [][]string }
	if a.post(ctx, "/communities", map[string]any{"accounts": accounts, "pairs": pairs}, &result, 4*time.Second) != nil {
		return nil
	}
	return e.GroupCommunities(result.Groups)
}
