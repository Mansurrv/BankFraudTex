package intel

import (
	"fmt"
	"hash/fnv"
	"math"
	"sort"
	"strings"
	"time"
)

type GraphOptions struct {
	Focus, Finding, Layout, Community, Remove, RemoveTx, Disconnect string
	After, Before                                                   time.Time
	Expand, Hide, Pin                                               []string
	Limit                                                           int
}

func (e *Engine) Graph(o GraphOptions) Graph {
	o.Limit = max(12, min(150, o.Limit))
	f, _ := e.Finding(o.Finding)
	result := Graph{Nodes: []Entity{}, Edges: []Edge{}, Total: len(e.Entities), Version: LedgerVersion}
	highlighted := map[string]bool{}
	important := map[string]bool{}
	for _, id := range f.Transactions {
		highlighted[id] = true
	}
	for _, id := range f.Entities {
		important[id] = true
	}
	groups := map[string]*Edge{}
	ranks := map[string]float64{}
	degree := map[string]int{}
	adj := map[string]map[string]float64{}
	addNeighbor := func(a, b string, w float64) {
		if adj[a] == nil {
			adj[a] = map[string]float64{}
		}
		adj[a][b] += w
	}
	visible := func(a, b string) bool {
		return a != o.Remove && b != o.Remove && a != o.Disconnect && b != o.Disconnect &&
			(o.Community == "" || e.Entities[a].Community == o.Community && e.Entities[b].Community == o.Community)
	}
	for _, t := range e.Ledger.Transactions {
		if t.ID == o.RemoveTx || !visible(t.From, t.To) || (!o.Before.IsZero() && t.Time.After(o.Before)) || (!o.After.IsZero() && t.Time.Before(o.After)) {
			continue
		}
		result.Window++
		id := t.From + ">" + t.To
		g := groups[id]
		if g == nil {
			g = &Edge{ID: id, From: t.From, To: t.To, Kind: "Transfer", Status: "verified", Transactions: []string{}}
			groups[id] = g
		}
		g.Count++
		g.USD += t.USD
		anchor := e.End
		if !o.Before.IsZero() {
			anchor = o.Before
		}
		g.Recency = math.Max(g.Recency, math.Exp(-math.Max(0, anchor.Sub(t.Time).Hours())/140))
		if highlighted[t.ID] {
			g.Highlight = true
			g.Transactions = append(g.Transactions, t.ID)
		} else if len(g.Transactions) < 3 {
			g.Transactions = append(g.Transactions, t.ID)
		}
		w := math.Log1p(t.USD)
		ranks[t.From] += w
		ranks[t.To] += w
		addNeighbor(t.From, t.To, w)
		addNeighbor(t.To, t.From, w)
		degree[t.From]++
		degree[t.To]++
	}
	for _, link := range e.Ledger.Links {
		if !visible(link.From, link.To) {
			continue
		}
		groups[link.ID] = &Edge{ID: link.ID, From: link.From, To: link.To, Kind: link.Kind, Status: link.Status, Count: 1, Transactions: []string{}}
		weight := 24.0
		if e.Entities[link.From].Kind == "bank" {
			weight = 12
		}
		addNeighbor(link.From, link.To, weight)
		addNeighbor(link.To, link.From, weight)
		ranks[link.From] += weight
		ranks[link.To] += weight
		degree[link.From]++
		degree[link.To]++
	}
	picked := map[string]bool{}
	hidden := map[string]bool{}
	for _, id := range o.Hide {
		hidden[id] = true
	}
	add := func(id string) {
		n, exists := e.Entities[id]
		if exists && len(picked) < o.Limit && id != o.Remove && !hidden[id] && (o.Community == "" || n.Community == o.Community) {
			picked[id] = true
		}
	}
	add(o.Focus)
	for _, id := range f.Entities {
		add(id)
	}
	for _, id := range o.Pin {
		add(id)
	}
	for _, id := range o.Expand {
		add(id)
		neighbors := sortKeys(adj[id])
		count := 0
		for _, v := range neighbors {
			if picked[v] || hidden[v] {
				continue
			}
			add(v)
			count++
			if count >= 8 {
				break
			}
		}
	}
	if o.Focus != "" {
		neighbors := sortKeys(adj[o.Focus])
		for _, id := range neighbors[:min(12, len(neighbors))] {
			add(id)
		}
	}
	if len(f.Entities) > 0 {
		neighbors := sortKeys(adj[f.Subject])
		for _, id := range neighbors[:min(9, len(neighbors))] {
			add(id)
		}
	}
	byGroup := map[string]map[string]float64{}
	groupNames := []string{}
	for id, n := range e.Entities {
		if o.Community != "" && o.Community != n.Community {
			continue
		}
		if byGroup[n.Community] == nil {
			byGroup[n.Community] = map[string]float64{}
			groupNames = append(groupNames, n.Community)
		}
		weight := ranks[id]
		if n.Kind != "account" {
			weight += 260
		}
		byGroup[n.Community][id] = weight
	}
	sort.Strings(groupNames)
	ordered := map[string][]string{}
	for _, name := range groupNames {
		ordered[name] = sortKeys(byGroup[name])
	}
	for j := 0; j < len(e.Entities) && len(picked) < o.Limit; j++ {
		for _, group := range groupNames {
			if len(ordered[group]) > j {
				add(ordered[group][j])
			}
		}
	}
	for _, n := range e.Ledger.Entities {
		if !picked[n.ID] {
			continue
		}
		n.Score = e.Scores[n.ID]
		if !o.Before.IsZero() {
			n.Score = 0
			for _, finding := range e.Findings {
				if finding.Subject == n.ID && !finding.End.After(o.Before) {
					n.Score = max(n.Score, finding.Score)
				}
			}
		}
		n.Size = math.Min(1.42, .45+math.Log1p(float64(degree[n.ID]))/8)
		if n.ID == f.Subject {
			n.Size = 1.65
		} else if important[n.ID] {
			n.Size = 1.18
		}
		result.Nodes = append(result.Nodes, n)
	}
	var edges []*Edge
	for _, edge := range groups {
		if picked[edge.From] && picked[edge.To] {
			edges = append(edges, edge)
		}
	}
	sort.Slice(edges, func(i, j int) bool {
		a, b := edges[i], edges[j]
		if a.Highlight != b.Highlight {
			return a.Highlight
		}
		if (a.USD == 0) != (b.USD == 0) {
			return a.USD == 0
		}
		if a.USD != b.USD {
			return a.USD > b.USD
		}
		return a.ID < b.ID
	})
	used := map[string]int{}
	for _, edge := range edges {
		if edge.Highlight || edge.USD == 0 || used[edge.From] < 2 || used[edge.To] < 2 || (important[edge.From] && important[edge.To] && used[edge.From] < 5 && used[edge.To] < 5) {
			result.Edges = append(result.Edges, *edge)
			used[edge.From]++
			used[edge.To]++
		}
		if len(result.Edges) >= o.Limit*4 {
			break
		}
	}
	organize(&result, o.Layout, f, important, o.Focus)
	return result
}

func sortKeys(values map[string]float64) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		if values[keys[i]] == values[keys[j]] {
			return keys[i] < keys[j]
		}
		return values[keys[i]] > values[keys[j]]
	})
	return keys
}

func stable(s string) float64 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(s))
	return float64(h.Sum32()%10001) / 10000
}

func organize(graph *Graph, mode string, f Finding, selected map[string]bool, focus string) {
	if len(graph.Nodes) == 0 {
		return
	}
	centers := map[string]Vec{
		"Institutional banking": {-6.6, -2.9, -2.1},
		"Retail services":       {-5.7, 2.5, .8},
		"Wholesale trade":       {5.1, -2.5, 1.2},
		"Digital commerce":      {5.1, 2.4, -1.2},
		"Meridian corridor":     {0, 0, 0},
	}
	nodes := graph.Nodes
	anchors := make([]Vec, len(nodes))
	special := make([]bool, len(nodes))
	index := map[string]int{}
	stage := map[string]int{}
	if len(f.Entities) > 0 {
		for _, edge := range graph.Edges {
			if edge.Highlight && edge.To == f.Subject {
				stage[edge.From] = -1
			}
		}
		for pass := 0; pass < 4; pass++ {
			for _, edge := range graph.Edges {
				if edge.Highlight && edge.To != f.Subject && stage[edge.From] >= 0 && edge.From != edge.To {
					if stage[edge.From] > 0 || edge.From == f.Subject {
						stage[edge.To] = min(3, max(stage[edge.To], stage[edge.From]+1))
					}
				}
			}
		}
	}
	stageCounts := map[int]int{}
	for id := range selected {
		stageCounts[stage[id]]++
	}
	stageSeen := map[int]int{}
	groupSeen := map[string]int{}
	for i, n := range nodes {
		index[n.ID] = i
		group := n.Community
		if mode == "Geography" {
			group = n.Location
		}
		c, ok := centers[group]
		if !ok {
			angle := stable(group) * 2 * math.Pi
			c = Vec{5.4 * math.Cos(angle), 3.4 * math.Sin(angle), 2 * (stable(group+"z") - .5)}
		}
		if mode == "Hierarchical" {
			layers := map[string]float64{"bank": 3.6, "company": 2.0, "person": .4, "account": -1.3, "device": -3}
			c = Vec{(stable(group) - .5) * 11, layers[n.Kind], (stable(group+"y") - .5) * 4}
		}
		if mode == "Risk" {
			c = Vec{(float64(n.Score)/100 - .35) * 9, (stable(n.Community) - .5) * 7, 0}
		}
		if mode == "Time" {
			var intensity float64
			for _, edge := range graph.Edges {
				if edge.From == n.ID || edge.To == n.ID {
					intensity = math.Max(intensity, edge.Recency)
				}
			}
			c = Vec{(intensity - .5) * 12, (stable(n.Community) - .5) * 6, 0}
		}
		if selected[n.ID] && (mode == "Communities" || mode == "Force-directed" || mode == "") {
			s := stage[n.ID]
			j := stageSeen[s]
			stageSeen[s]++
			if n.ID == f.Subject {
				c = Vec{-.95, .1, 1.05}
			} else {
				y := float64(j) - float64(stageCounts[s]-1)/2
				if s == 0 {
					c = Vec{1.1 + 1.0*y, 1.15 * y, 1.2}
				} else {
					c = Vec{-.95 + float64(s)*1.6, 1.1*y + float64(s%2)*.5, 1.3 + (stable(n.ID)-.5)*1.9}
				}
			}
			special[i] = true
		} else {
			j := groupSeen[group]
			groupSeen[group]++
			angle := float64(j) * 2.399963
			r := .73 * math.Sqrt(float64(j)+.45)
			c[0] += math.Cos(angle) * r
			c[1] += math.Sin(angle) * r * .72
			c[2] += (stable(n.ID) - .5) * 2.5
			if group == "Meridian corridor" && len(selected) > 0 {
				c[0] -= .2
				c[1] += -2.5
				c[2] -= 1.5
			}
		}
		anchors[i] = c
		nodes[i].Position = c
	}
	iterations := 38
	spring := .012
	if mode == "Force-directed" {
		iterations = 72
		spring = .027
	}
	for step := 0; step < iterations; step++ {
		forces := make([]Vec, len(nodes))
		for i := range nodes {
			for j := i + 1; j < len(nodes); j++ {
				a, b := nodes[i].Position, nodes[j].Position
				d := Vec{a[0] - b[0], a[1] - b[1], (a[2] - b[2]) * .72}
				r := .03 + d[0]*d[0] + d[1]*d[1] + d[2]*d[2]
				if r > 20 {
					continue
				}
				factor := .032 / (r * math.Sqrt(r))
				for k := range d {
					v := d[k] * factor
					forces[i][k] += v
					forces[j][k] -= v
				}
			}
		}
		for _, edge := range graph.Edges {
			i, j := index[edge.From], index[edge.To]
			d := Vec{nodes[j].Position[0] - nodes[i].Position[0], nodes[j].Position[1] - nodes[i].Position[1], nodes[j].Position[2] - nodes[i].Position[2]}
			r := math.Sqrt(d[0]*d[0] + d[1]*d[1] + d[2]*d[2])
			if r < 1.05 {
				continue
			}
			k := spring / (1 + r*.18)
			if nodes[i].Community != nodes[j].Community {
				k *= .3
			}
			for axis := range d {
				v := d[axis] * k
				forces[i][axis] += v
				forces[j][axis] -= v
			}
		}
		for i := range nodes {
			tether := .105
			if special[i] {
				tether = .24
			}
			for k := range anchors[i] {
				forces[i][k] += (anchors[i][k] - nodes[i].Position[k]) * tether
				nodes[i].Position[k] += math.Max(-.2, math.Min(.2, forces[i][k]))
			}
		}
	}
}

type EntityDetail struct {
	Entity         Entity        `json:"entity"`
	Inflow         float64       `json:"inflow"`
	Outflow        float64       `json:"outflow"`
	Count          int           `json:"count"`
	Counterparties int           `json:"counterparties"`
	Findings       []Finding     `json:"findings"`
	Transactions   []Transaction `json:"transactions"`
	Fingerprint    *Fingerprint  `json:"fingerprint,omitempty"`
}

func (e *Engine) Detail(id string) (EntityDetail, bool) {
	n, ok := e.Entities[id]
	if !ok {
		return EntityDetail{}, false
	}
	n.Score = e.Scores[id]
	d := EntityDetail{Entity: n, Findings: []Finding{}, Transactions: []Transaction{}}
	if f, ok := e.Features[id]; ok {
		d.Fingerprint = &f
	}
	peers := map[string]bool{}
	txs := e.ByAccount[id]
	for i := len(txs) - 1; i >= 0; i-- {
		t := txs[i]
		if t.From == id {
			d.Outflow += t.USD
			peers[t.To] = true
		} else {
			d.Inflow += t.USD
			peers[t.From] = true
		}
		if len(d.Transactions) < 12 {
			d.Transactions = append(d.Transactions, t)
		}
	}
	d.Count = len(txs)
	d.Counterparties = len(peers)
	for _, f := range e.Findings {
		for _, k := range f.Entities {
			if k == id {
				d.Findings = append(d.Findings, f)
				break
			}
		}
	}
	return d, true
}

type Relationship struct {
	Entity     string     `json:"entity"`
	Name       string     `json:"name"`
	Status     string     `json:"status"`
	Confidence int        `json:"confidence"`
	Signals    []Evidence `json:"signals"`
}

func (e *Engine) Relationships(id string) []Relationship {
	matches := map[string]*Relationship{}
	add := func(other string, weight int, ev Evidence) {
		if id == other {
			return
		}
		if matches[other] == nil {
			matches[other] = &Relationship{Entity: other, Name: e.Entities[other].Name, Status: "inferred", Signals: []Evidence{}}
		}
		r := matches[other]
		for _, existing := range r.Signals {
			if existing.ID == ev.ID {
				return
			}
		}
		r.Signals = append(r.Signals, ev)
		if ev.Status == "verified" {
			r.Confidence = 100
			r.Status = "verified"
		} else if r.Status == "inferred" {
			r.Confidence = min(96, r.Confidence+weight)
		}
	}
	neighbors := map[string]Link{}
	for _, link := range e.Ledger.Links {
		var other string
		if link.From == id {
			other = link.To
		} else if link.To == id {
			other = link.From
		} else {
			continue
		}
		neighbors[other] = link
		add(other, 100, Evidence{ID: link.ID, Label: link.Kind + " · " + e.Entities[other].Name, Status: "verified", Focus: other})
	}
	for _, link := range e.Ledger.Links {
		for _, pair := range [][2]string{{link.From, link.To}, {link.To, link.From}} {
			first, ok := neighbors[pair[0]]
			if !ok || e.Entities[pair[1]].Kind != "account" || e.Entities[pair[0]].Kind == "bank" {
				continue
			}
			kind := e.Entities[pair[0]].Kind
			weight := 22
			if kind == "device" {
				weight = 37
			} else if kind == "company" {
				weight = 32
			}
			add(pair[1], weight, Evidence{ID: first.ID + " / " + link.ID, Label: "Shared " + kind + " · " + e.Entities[pair[0]].Name, Status: "inferred", Focus: pair[1]})
		}
	}
	for _, a := range e.Ledger.Contacts {
		if a.Entity != id {
			continue
		}
		for _, b := range e.Ledger.Contacts {
			if a.Kind != b.Kind || a.Digest != b.Digest {
				continue
			}
			weight := 16
			if a.Kind == "phone" {
				weight = 39
			}
			add(b.Entity, weight, Evidence{ID: "MATCH-" + strings.ReplaceAll(a.Kind, " ", "-") + "-" + b.Entity, Label: "Shared " + a.Kind + " · " + a.Masked, Status: "inferred", Focus: b.Entity})
		}
	}
	own := map[string]Transaction{}
	for _, t := range e.ByAccount[id] {
		other := t.From
		if other == id {
			other = t.To
		}
		own[other] = t
	}
	for other, txs := range e.ByAccount {
		if other == id {
			continue
		}
		overlap := map[string]Transaction{}
		for _, t := range txs {
			peer := t.From
			if peer == other {
				peer = t.To
			}
			if _, ok := own[peer]; ok {
				overlap[peer] = t
			}
		}
		if len(overlap) >= 14 {
			keys := []string{}
			for k := range overlap {
				keys = append(keys, k)
			}
			sort.Strings(keys)
			t := overlap[keys[0]]
			add(other, 12, Evidence{ID: t.ID + " / " + own[keys[0]].ID, Label: fmt.Sprintf("%d common counterparties · example %s", len(overlap), e.Entities[keys[0]].Name), Status: "inferred", Focus: other})
		}
	}
	for _, m := range e.Similar(id) {
		if m.Score >= 76 {
			add(m.Entity, 14, Evidence{ID: "FP-" + m.Entity, Label: fmt.Sprintf("Behavior fingerprint similarity %d/100", m.Score), Status: "inferred", Focus: m.Entity})
		}
	}
	result := []Relationship{}
	for _, r := range matches {
		result = append(result, *r)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Confidence == result[j].Confidence {
			return result[i].Entity < result[j].Entity
		}
		return result[i].Confidence > result[j].Confidence
	})
	return result[:min(26, len(result))]
}
