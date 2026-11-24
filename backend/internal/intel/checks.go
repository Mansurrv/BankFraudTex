package intel

import (
	"fmt"
	"math"
)

func findingCheck(condition string, facts []string, txs ...Transaction) FindingCheck {
	check := FindingCheck{Condition: condition, Observations: facts}
	for _, t := range txs {
		check.References = append(check.References, t.ID)
	}
	return check
}

// Pick the smallest chronological set that demonstrates both the transfer and recipient counts.
func burstWitness(txs []Transaction, count, recipients int) []Transaction {
	picked, seen := map[string]bool{}, map[string]bool{}
	for _, t := range txs {
		if len(seen) == recipients {
			break
		}
		if !seen[t.To] {
			seen[t.To], picked[t.ID] = true, true
		}
	}
	for _, t := range txs {
		if len(picked) == count {
			break
		}
		picked[t.ID] = true
	}
	result := make([]Transaction, 0, len(picked))
	for _, t := range txs {
		if picked[t.ID] {
			result = append(result, t)
		}
	}
	return result
}

func burstCheck(condition string, witness []Transaction) FindingCheck {
	span := int(math.Ceil(witness[len(witness)-1].Time.Sub(witness[0].Time).Minutes()))
	return findingCheck(condition,
		[]string{fmt.Sprintf("%d outgoing transfers to %d distinct accounts within %d minutes", len(witness), diversity(witness), span)},
		witness...)
}
