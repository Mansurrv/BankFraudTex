package intel

import (
	"fmt"
	"sort"
)

type Community struct {
	Name           string   `json:"name"`
	Size           int      `json:"size"`
	Accounts       []string `json:"accounts"`
	Representative string   `json:"representative"`
	Internal       int      `json:"internal"`
}

// Communities applies weighted label propagation to the undirected transaction
// graph. A confidence margin prevents sparsely connected peers from absorbing
// an otherwise stable community through a tie.
func (e *Engine) Communities() []Community {
	if e.Discovered != nil {
		return e.Discovered
	}
	adj := map[string]map[string]float64{}
	for id, n := range e.Entities {
		if n.Kind == "account" {
			adj[id] = map[string]float64{}
		}
	}
	for _, t := range e.Ledger.Transactions {
		adj[t.From][t.To]++
		adj[t.To][t.From]++
	}
	ids := []string{}
	labels := map[string]string{}
	for id := range adj {
		ids = append(ids, id)
		labels[id] = id
	}
	sort.Strings(ids)
	sort.SliceStable(ids, func(i, j int) bool { return len(adj[ids[i]]) > len(adj[ids[j]]) })
	for pass := 0; pass < 14; pass++ {
		changed := false
		for _, id := range ids {
			support := map[string]float64{}
			for peer, w := range adj[id] {
				support[labels[peer]] += w
			}
			ranked := sortKeys(support)
			if len(ranked) > 0 && support[ranked[0]] > support[labels[id]]*1.10 {
				labels[id] = ranked[0]
				changed = true
			}
		}
		if !changed {
			break
		}
	}
	partitions := map[string][]string{}
	for _, id := range ids {
		label := labels[id]
		partitions[label] = append(partitions[label], id)
	}
	groups := make([][]string, 0, len(partitions))
	for _, members := range partitions {
		groups = append(groups, members)
	}
	return e.GroupCommunities(groups)
}

func (e *Engine) GroupCommunities(partitions [][]string) []Community {
	result := []Community{}
	index := map[string]int{}
	for _, members := range partitions {
		if len(members) == 0 {
			continue
		}
		accounts := []string{}
		representative := ""
		for _, id := range members {
			if e.Entities[id].Kind != "account" {
				return nil
			}
			if _, found := index[id]; found {
				return nil
			}
			index[id] = len(result)
			accounts = append(accounts, id)
			if len(e.ByAccount[id]) > len(e.ByAccount[representative]) || (len(e.ByAccount[id]) == len(e.ByAccount[representative]) && (representative == "" || id < representative)) {
				representative = id
			}
		}
		sort.Strings(accounts)
		result = append(result, Community{Size: len(accounts), Representative: representative, Accounts: accounts})
	}
	if len(index) != len(e.Features) {
		return nil
	}
	for _, t := range e.Ledger.Transactions {
		if index[t.From] == index[t.To] {
			result[index[t.From]].Internal++
		}
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Size == result[j].Size {
			return result[i].Representative < result[j].Representative
		}
		return result[i].Size > result[j].Size
	})
	for i := range result {
		result[i].Name = fmt.Sprintf("Transaction community %02d", i+1)
	}
	return result
}
