package intel

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

type Fingerprint struct {
	Entity   string             `json:"entity"`
	Features map[string]float64 `json:"features"`
}

type Similarity struct {
	Fingerprint
	Score        int                `json:"score"`
	Contributors map[string]float64 `json:"contributors"`
}

var FeatureNames = []string{"Daily frequency", "Median amount", "Amount spread", "Inflow share", "Counterparty diversity", "Repeat route share", "Recent activity ratio", "Off-hours share", "Fast pass-through share"}

func (e *Engine) fingerprints() map[string]Fingerprint {
	result := map[string]Fingerprint{}
	for id, n := range e.Entities {
		if n.Kind != "account" {
			continue
		}
		txs := e.ByAccount[id]
		count := float64(len(txs))
		values := make([]float64, len(txs))
		var in, out, recent, off, pass, repeat float64
		routes := map[string]int{}
		var credit time.Time
		for i, t := range txs {
			values[i] = t.USD
			if t.To == id {
				in += t.USD
				credit = t.Time
				routes[t.From]++
			} else {
				out += t.USD
				if !credit.IsZero() && t.Time.Sub(credit) <= 30*time.Minute {
					pass++
				}
				routes[t.To]++
			}
			if t.Time.After(e.End.Add(-72 * time.Hour)) {
				recent++
			}
			if t.Time.UTC().Hour() < 6 || t.Time.UTC().Hour() >= 22 {
				off++
			}
		}
		for _, n := range routes {
			if n > 1 {
				repeat += float64(n - 1)
			}
		}
		sort.Float64s(values)
		median := pct(values, .5)
		days := math.Max(4, e.End.Sub(e.Start).Hours()/24)
		v := []float64{count / days, median, (pct(values, .9) - pct(values, .1)) / math.Max(1, median), in / math.Max(1, in+out), float64(len(routes)), repeat / math.Max(1, count), (recent / 3) / math.Max(.1, (count-recent)/(days-3)), off / math.Max(1, count), pass / math.Max(1, count)}
		fields := map[string]float64{}
		for i, k := range FeatureNames {
			fields[k] = math.Round(v[i]*100) / 100
		}
		result[id] = Fingerprint{Entity: id, Features: fields}
	}
	return result
}

func pct(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	return sorted[int(float64(len(sorted)-1)*p)]
}

func (e *Engine) baseline() (map[string]float64, map[string]float64) {
	center, scale := map[string]float64{}, map[string]float64{}
	for _, name := range FeatureNames {
		v := make([]float64, 0, len(e.Features))
		for _, f := range e.Features {
			v = append(v, f.Features[name])
		}
		sort.Float64s(v)
		center[name] = pct(v, .5)
		for i := range v {
			v[i] = math.Abs(v[i] - center[name])
		}
		sort.Float64s(v)
		scale[name] = math.Max(.05, 1.4826*pct(v, .5))
	}
	return center, scale
}

func (e *Engine) Similar(id string) []Similarity {
	target, ok := e.Features[id]
	if !ok {
		return []Similarity{}
	}
	_, scale := e.baseline()
	result := []Similarity{}
	for other, f := range e.Features {
		if id == other {
			continue
		}
		contributors := map[string]float64{}
		var similarity float64
		for _, key := range FeatureNames {
			value := 1 / (1 + math.Abs(f.Features[key]-target.Features[key])/scale[key])
			contributors[key] = math.Round(value * 100)
			similarity += value
		}
		result = append(result, Similarity{Fingerprint: f, Score: int(math.Round(similarity / float64(len(FeatureNames)) * 100)), Contributors: contributors})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Score == result[j].Score {
			return result[i].Entity < result[j].Entity
		}
		return result[i].Score > result[j].Score
	})
	return result[:min(8, len(result))]
}

func (e *Engine) makeFinding(kind, title, subject, summary string, score int, txs []Transaction, reasons ...string) Finding {
	f := Finding{ID: kind + "-" + subject, Kind: kind, Title: title, Subject: subject, Summary: summary, Score: score, Reasons: reasons, Transactions: []string{}, Entities: []string{subject}, Evidence: []Evidence{}}
	seen := map[string]bool{subject: true}
	txs = append([]Transaction(nil), txs...)
	sort.Slice(txs, func(i, j int) bool {
		if txs[i].Time.Equal(txs[j].Time) {
			return txs[i].ID < txs[j].ID
		}
		return txs[i].Time.Before(txs[j].Time)
	})
	for _, t := range txs {
		if len(f.Transactions) == 0 {
			f.Start = t.Time
		}
		f.End = t.Time
		f.USD += t.USD
		f.Transactions = append(f.Transactions, t.ID)
		f.Evidence = append(f.Evidence, e.TxEvidence(t))
		for _, id := range []string{t.From, t.To} {
			if !seen[id] {
				f.Entities = append(f.Entities, id)
				seen[id] = true
			}
		}
	}
	return f
}

func (e *Engine) detect(ml map[string]float64) []Finding {
	result := []Finding{}
	center, scale := e.baseline()
	for id, f := range e.Features {
		txs := e.ByAccount[id]
		out := []Transaction{}
		for _, t := range txs {
			if t.From == id {
				out = append(out, t)
			}
		}
		name := e.Entities[id].Name
		if burst := densest(out, 25*time.Minute, 15000, 1e12); len(burst) >= 4 && diversity(burst) >= 4 {
			witness := burstWitness(burst, 4, 4)
			// Restrict the traced cluster to closely timed, high-value ledger records.
			flow := e.connectedFlow(id, burst[0].Time.Add(-12*time.Minute), burst[len(burst)-1].Time.Add(21*time.Minute), 15000, witness)
			// Keep the focal account first and report the ledger span explicitly.
			reason := fmt.Sprintf("%d outgoing transfers to %d distinct accounts within %d minutes", len(burst), diversity(burst), int(math.Ceil(burst[len(burst)-1].Time.Sub(burst[0].Time).Minutes())))
			summary := fmt.Sprintf("%s sent high-value transfers to several accounts in quick succession.", name)
			credit := false
			inbound := map[string]int{}
			for _, t := range flow {
				if t.To == id && t.Time.Before(burst[0].Time) {
					credit = true
				}
				inbound[t.To]++
			}
			if credit {
				summary = fmt.Sprintf("%s received and redistributed high-value transfers in quick succession.", name)
			}
			reasons := []string{reason}
			for to, n := range inbound {
				if to != id && n > 1 {
					summary += " The outgoing routes converge on a smaller set of accounts."
					reasons = append(reasons, "Multiple linked transfers reach the same downstream account")
					break
				}
			}
			reasons = append(reasons, "Gross transfer volume can count the same funds across multiple hops")
			finding := e.makeFinding("rapid", "Rapid fund dispersion", id, summary, 94, flow, reasons...)
			finding.Checks = []FindingCheck{burstCheck("At least four recipients in 25 minutes, with each transfer at least 15,000 USD equivalent.", witness)}
			result = append(result, finding)
		}
		if burst := densest(out, 35*time.Minute, 9000, 9999.99); len(burst) >= 5 && diversity(burst) >= 4 {
			finding := e.makeFinding("splitting", "Repeated similar transfers", id, fmt.Sprintf("%s sent several similarly sized transfers across distinct counterparties in under 35 minutes.", name), 88, burst,
				fmt.Sprintf("%d transfers between USD-equivalent 9,000 and 10,000", len(burst)), "Amount and timing similarity triggered the rule", "The sequence alone does not establish intent")
			finding.Checks = []FindingCheck{burstCheck("At least five transfers to four recipients in 35 minutes, each from 9,000 to 9,999.99 USD equivalent.", burstWitness(burst, 5, 4))}
			result = append(result, finding)
		}
		burst := densest(out, 12*time.Minute, 1500, 1e12)
		if len(burst) >= 5 && diversity(burst) >= 5 {
			finding := e.makeFinding("burst", "Sudden counterparty expansion", id, fmt.Sprintf("%s contacted %d counterparties in a concentrated burst.", name, diversity(burst)), 84, burst,
				fmt.Sprintf("%d distinct recipients within 12 minutes", diversity(burst)), "Review whether the burst aligns with normal operating activity")
			finding.Checks = []FindingCheck{burstCheck("At least five recipients in 12 minutes, with each transfer at least 1,500 USD equivalent.", burstWitness(burst, 5, 5))}
			result = append(result, finding)
		}
		var extreme []Transaction
		median := f.Features["Median amount"]
		threshold := math.Max(11000, median*14)
		for _, t := range out {
			if t.USD >= threshold {
				extreme = append(extreme, t)
			}
		}
		if len(extreme) > 0 {
			sort.Slice(extreme, func(i, j int) bool { return extreme[i].USD > extreme[j].USD })
			extreme = extreme[:min(3, len(extreme))]
			reasons := []string{"Comparison uses USD-equivalent values"}
			if median > 0 {
				reasons = append([]string{fmt.Sprintf("Largest transfer is %.1f× the account median", extreme[0].USD/median)}, reasons...)
			}
			finding := e.makeFinding("amount", "Unusual transfer amount", id, fmt.Sprintf("%s made an outgoing transfer far above its median transaction amount.", name), 73, extreme,
				reasons...)
			finding.Checks = []FindingCheck{findingCheck("An outgoing transfer reaches 11,000 USD equivalent and 14 times the account median.",
				[]string{fmt.Sprintf("Transfer: %s USD equivalent. Account median: %s. Applied threshold: %s.",
					formatMoney(extreme[0].USD), formatMoney(median), formatMoney(threshold))}, extreme[0])}
			result = append(result, finding)
		}
		type deviation struct {
			name string
			z    float64
		}
		dev := []deviation{}
		for _, k := range FeatureNames {
			dev = append(dev, deviation{k, math.Abs(f.Features[k]-center[k]) / scale[k]})
		}
		sort.SliceStable(dev, func(i, j int) bool { return dev[i].z > dev[j].z })
		if len(txs) >= 10 && (ml[id] >= .81 || (dev[0].z >= 4.4 && dev[1].z >= 2.5)) {
			sample := txs[max(0, len(txs)-5):]
			reasons := []string{}
			for _, d := range dev[:3] {
				reasons = append(reasons, fmt.Sprintf("%s is %.1f robust deviations from the account population median", d.name, d.z))
			}
			if value, ok := ml[id]; ok {
				reasons = append(reasons, fmt.Sprintf("Isolation Forest percentile %.0f/100; deviations describe observed features", value*100))
			}
			finding := e.makeFinding("profile", "Behavior outside the peer baseline", id, fmt.Sprintf("%s has an uncommon combination of observed account features. Evidence shows the most recent entries for review.", name), min(79, 60+int(dev[0].z)), sample, reasons...)
			finding.Checks = []FindingCheck{
				findingCheck("At least ten recorded transfers in the account history.", []string{fmt.Sprintf("%d recorded transfers in the account history", len(txs))}),
			}
			if dev[0].z >= 4.4 && dev[1].z >= 2.5 {
				finding.Checks = append(finding.Checks, findingCheck("Two account features reach 4.4 and 2.5 robust deviations from their peer medians, respectively.", reasons[:2]))
			}
			if ml[id] >= .81 {
				finding.Checks = append(finding.Checks, findingCheck("Isolation Forest percentile is at least 81 out of 100.", reasons[len(reasons)-1:]))
			}
			result = append(result, finding)
		}
	}
	result = append(result, e.cycles()...)
	result = append(result, e.muleNetworks()...)
	sort.Slice(result, func(i, j int) bool {
		a, b := result[i], result[j]
		if a.Score != b.Score {
			return a.Score > b.Score
		}
		if !a.End.Equal(b.End) {
			return a.End.After(b.End)
		}
		return a.ID < b.ID
	})
	return result
}

func densest(txs []Transaction, window time.Duration, low, high float64) []Transaction {
	filtered := []Transaction{}
	for _, t := range txs {
		if t.USD >= low && t.USD <= high {
			filtered = append(filtered, t)
		}
	}
	left, bestLeft, bestRight := 0, 0, 0
	for right, t := range filtered {
		for t.Time.Sub(filtered[left].Time) > window {
			left++
		}
		if right+1-left > bestRight-bestLeft {
			bestLeft, bestRight = left, right+1
		}
	}
	return filtered[bestLeft:bestRight]
}

func diversity(txs []Transaction) int {
	to := map[string]bool{}
	for _, t := range txs {
		to[t.To] = true
	}
	return len(to)
}

func (e *Engine) connectedFlow(id string, start, end time.Time, minUSD float64, witnesses []Transaction) []Transaction {
	txs := append([]Transaction(nil), witnesses...)
	used := map[string]bool{}
	for _, t := range witnesses {
		used[t.ID] = true
	}
	seen := map[string]bool{id: true}
	for depth := 0; depth < 4; depth++ {
		next := map[string]bool{}
		for _, t := range e.Ledger.Transactions {
			if !t.Time.Before(start) && !t.Time.After(end) && t.USD >= minUSD && (seen[t.From] || seen[t.To]) {
				next[t.From] = true
				next[t.To] = true
			}
		}
		for k := range next {
			seen[k] = true
		}
	}
	for _, t := range e.Ledger.Transactions {
		if len(txs) >= 48 {
			break
		}
		if !used[t.ID] && !t.Time.Before(start) && !t.Time.After(end) && t.USD >= minUSD && seen[t.From] && seen[t.To] {
			txs = append(txs, t)
		}
	}
	return txs
}

func (e *Engine) cycles() []Finding {
	out := map[string][]Transaction{}
	for _, t := range e.Ledger.Transactions {
		if t.USD >= 12500 {
			out[t.From] = append(out[t.From], t)
		}
	}
	found := []Finding{}
	groups := map[string]bool{}
	findingIDs := map[string]bool{}
	for _, first := range e.Ledger.Transactions {
		if first.USD < 12500 {
			continue
		}
		var walk func(string, []Transaction, map[string]bool)
		walk = func(id string, path []Transaction, visited map[string]bool) {
			if len(path) >= 5 {
				return
			}
			for _, t := range out[id] {
				if !t.Time.After(path[len(path)-1].Time) || t.Time.Sub(first.Time) > 2*time.Hour {
					continue
				}
				if t.To == first.From {
					closed := append(append([]Transaction(nil), path...), t)
					ids := []string{}
					for _, p := range closed {
						ids = append(ids, p.ID)
					}
					sort.Strings(ids)
					key := strings.Join(ids, ",")
					if !groups[key] {
						groups[key] = true
						f := e.makeFinding("cycle", "Circular transfer sequence", first.From,
							fmt.Sprintf("A directed sequence of %d transfers returns to %s.", len(closed), e.Entities[first.From].Name),
							91, closed, "Ordered directed edges return to the opening account", "All transfers occurred within two hours", "The ledger confirms transfers; it does not identify the same underlying funds")
						f.Checks = []FindingCheck{findingCheck("Two to five time-ordered transfers of at least 12,500 USD equivalent return to the opening account in two hours.",
							[]string{f.Summary, fmt.Sprintf("Recorded span: %d minutes", int(math.Ceil(t.Time.Sub(first.Time).Minutes())))}, closed...)}
						if len(found) > 0 {
							f.ID += "-" + first.ID
						}
						baseID := f.ID
						for suffix := 2; findingIDs[f.ID]; suffix++ {
							f.ID = fmt.Sprintf("%s-%d", baseID, suffix)
						}
						findingIDs[f.ID] = true
						found = append(found, f)
					}
				} else if !visited[t.To] {
					visited[t.To] = true
					walk(t.To, append(path, t), visited)
					delete(visited, t.To)
				}
			}
		}
		walk(first.To, []Transaction{first}, map[string]bool{first.From: true, first.To: true})
		if len(found) >= 30 {
			break
		}
	}
	return found
}

func formatMoney(value float64) string {
	s := fmt.Sprintf("%.2f", value)
	if strings.HasSuffix(s, ".00") {
		s = strings.TrimSuffix(s, ".00")
	}
	whole, decimal, _ := strings.Cut(s, ".")
	for i := len(whole) - 3; i > 0; i -= 3 {
		whole = whole[:i] + "," + whole[i:]
	}
	if decimal != "" {
		return whole + "." + decimal
	}
	return whole
}
