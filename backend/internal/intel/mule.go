package intel

import (
	"fmt"
	"math"
	"sort"
	"time"
)

const muleWindow = 30 * time.Minute

type muleLeg struct {
	split, onward Transaction
}

type muleEpisode struct {
	credit Transaction
	legs   map[string]muleLeg
}

func comparableMuleAmount(outgoing, incoming float64) bool {
	return outgoing >= incoming*.60 && outgoing <= incoming*1.15
}

func (e *Engine) fastOnwardTransfers() map[string]Transaction {
	onward := map[string]Transaction{}
	for account, txs := range e.ByAccount {
		var credit Transaction
		for _, tx := range txs {
			if tx.To == account {
				credit = tx
				continue
			}
			// A new credit ends the attribution window. Use each debit once.
			if credit.ID != "" && tx.To != credit.From && tx.Time.After(credit.Time) &&
				tx.Time.Sub(credit.Time) <= muleWindow && comparableMuleAmount(tx.USD, credit.USD) {
				onward[credit.ID] = tx
				credit = Transaction{}
			}
		}
	}
	return onward
}

func muleEpisodes(account string, txs []Transaction, onward map[string]Transaction) []muleEpisode {
	var episodes []muleEpisode
	var episode muleEpisode
	for _, tx := range txs {
		if tx.To == account {
			if len(episode.legs) >= 2 {
				episodes = append(episodes, episode)
			}
			episode = muleEpisode{credit: tx}
			continue
		}
		relay, ok := onward[tx.ID]
		if !ok || episode.credit.ID == "" || tx.To == episode.credit.From || relay.To == episode.credit.From ||
			!tx.Time.After(episode.credit.Time) || tx.Time.Sub(episode.credit.Time) > muleWindow {
			continue
		}
		if episode.legs == nil {
			episode.legs = map[string]muleLeg{}
		}
		if _, seen := episode.legs[tx.To]; !seen {
			episode.legs[tx.To] = muleLeg{split: tx, onward: relay}
		}
	}
	if len(episode.legs) >= 2 {
		episodes = append(episodes, episode)
	}
	return episodes
}

func (e *Engine) muleNetworks() []Finding {
	onward := e.fastOnwardTransfers()
	var findings []Finding
	for hub, txs := range e.ByAccount {
		episodes := muleEpisodes(hub, txs, onward)
		if finding, ok := e.repeatedMuleRoutes(hub, episodes); ok {
			findings = append(findings, finding)
		}
	}
	return findings
}

func (e *Engine) repeatedMuleRoutes(hub string, episodes []muleEpisode) (Finding, bool) {
	for i := len(episodes) - 1; i > 0; i-- {
		current := episodes[i]
		vias := make([]string, 0, len(current.legs))
		for via := range current.legs {
			vias = append(vias, via)
		}
		sort.Strings(vias)
		for j := i - 1; j >= 0; j-- {
			prior := episodes[j]
			var priorUSD, currentUSD float64
			var longestTransit time.Duration
			var shared []string
			for _, via := range vias {
				leg := current.legs[via]
				earlier, ok := prior.legs[via]
				if !ok || earlier.onward.To != leg.onward.To || !earlier.onward.Time.Before(current.credit.Time) {
					continue
				}
				shared = append(shared, via)
				priorUSD += earlier.split.USD
				currentUSD += leg.split.USD
				longestTransit = max(longestTransit, earlier.onward.Time.Sub(earlier.split.Time), leg.onward.Time.Sub(leg.split.Time))
			}
			if len(shared) < 2 || !comparableMuleAmount(priorUSD, prior.credit.USD) || !comparableMuleAmount(currentUSD, current.credit.USD) {
				continue
			}
			name := e.Entities[hub].Name
			evidence := []Transaction{prior.credit, current.credit}
			splits := []Transaction{prior.credit, current.credit}
			checks := []FindingCheck{{}}
			reasons := []string{
				fmt.Sprintf("%d intermediary accounts reused the same directed routes across two separate inbound credits", len(shared)),
				fmt.Sprintf("Intermediaries forwarded comparable USD-equivalent amounts within %d minutes", int(math.Ceil(longestTransit.Minutes()))),
			}
			for _, via := range shared {
				a, b := prior.legs[via], current.legs[via]
				evidence = append(evidence, a.split, a.onward, b.split, b.onward)
				splits = append(splits, a.split, b.split)
				route := fmt.Sprintf("Repeated route: %s → %s → %s", name, e.Entities[via].Name, e.Entities[b.onward.To].Name)
				reasons = append(reasons, route)
				checks = append(checks, findingCheck("Each intermediary forwards 60–115% of its receipt within 30 minutes in both episodes.", []string{
					route,
					fmt.Sprintf("Onward transit: %d and %d minutes. Forwarded shares: %.1f%% and %.1f%%.",
						int(math.Ceil(a.onward.Time.Sub(a.split.Time).Minutes())), int(math.Ceil(b.onward.Time.Sub(b.split.Time).Minutes())),
						100*a.onward.USD/a.split.USD, 100*b.onward.USD/b.split.USD),
				}, a.split, a.onward, b.split, b.onward))
			}
			checks[0] = findingCheck("Two separate credits lead to at least two repeated routes. Within 30 minutes each distributes 60–115% of its credit.",
				[]string{reasons[0], fmt.Sprintf("Distributed shares: %.1f%% and %.1f%% of incoming credits.", 100*priorUSD/prior.credit.USD, 100*currentUSD/current.credit.USD)}, splits...)
			reasons = append(reasons, "Transfer timing and amounts support review. The origin of the funds and the account holders' intent require separate evidence.")
			finding := e.makeFinding("mule", "Money Mule / Dropper Networks", hub,
				fmt.Sprintf("%s repeatedly distributed incoming credits through the same intermediary accounts to downstream recipients.", name), 92, evidence, reasons...)
			finding.Checks = checks
			return finding, true
		}
	}
	return Finding{}, false
}
