package intel

import (
	"crypto/sha256"
	"fmt"
	"math"
	"math/rand"
	"sort"
	"time"
)

const DemoVersion = "orbit-synth-v1"

var DemoStart = time.Date(2026, 10, 14, 0, 0, 0, 0, time.UTC)
var DemoEnd = DemoStart.Add(30*24*time.Hour - time.Second)

var sectors = []string{"Meridian corridor", "Retail services", "Wholesale trade", "Digital commerce", "Institutional banking"}
var cities = []string{"Almaty", "Astana", "London", "Dubai", "Singapore"}

func account(i int) string { return fmt.Sprintf("ACC-%03d", i) }

func Synthetic() Ledger {
	random := rand.New(rand.NewSource(241))
	ledger := Ledger{}
	mainNames := []string{
		"Meridian Trading", "Northline Exports", "Delta Intermediary", "Atlas Holdings", "Silvergate Logistics",
		"Pacific Clearing", "Crown Settlement", "Ember Payments", "Halcyon Reserve", "Cobalt Partners",
		"Aster Commercial", "Juniper Exchange", "Vela Ventures", "Portside Supply", "Crescent Capital",
		"Harbor Mutual", "Lumen Retail", "Blue Finch", "Kestrel Advisory", "Mosaic Treasury",
	}
	prefix := []string{"Alder", "Jasper", "Solace", "Orchid", "Summit", "Cedar", "Boreal", "Nexus", "Spruce", "Citrine", "Redwood", "Aspen"}
	suffix := []string{"Services", "Trading", "Group", "Supply", "Finance", "Works", "Trust", "Commerce", "Enterprises", "Partners", "Markets", "Transit", "Systems", "Assets", "Studio"}
	for i := 1; i <= 180; i++ {
		group := (i - 1) / 36
		name := fmt.Sprintf("%s %s", prefix[(i-1)%len(prefix)], suffix[(i-1)/len(prefix)])
		if i <= len(mainNames) {
			name = mainNames[i-1]
		}
		ledger.Entities = append(ledger.Entities, Entity{
			ID: account(i), Name: name, Kind: "account", Community: sectors[group],
			Location: cities[(i+group)%len(cities)], Masked: fmt.Sprintf("•••• %04d", 2100+i),
		})
	}
	organizations := []string{"Meridian Group", "Aster Distribution", "Crescent Ventures", "Sable Retail Group", "Alder Marketplace", "Kestrel Wholesale", "Juniper Commodities", "Citrine Digital", "Atlantic Media", "Pacific Partners"}
	institutions := []string{"Northstar Bank", "Civic Bank", "Harbor Bank", "Union Settlement", "Pioneer Bank"}
	people := []string{"Ava Morgan", "Idris Malik", "Sofia Chen", "Nora Haddad", "Amir Park", "Leo Fischer", "Maya Singh", "Elias Novak", "Samira Costa", "Iris Kamal"}
	addEntity := func(id, name, kind string, group int) {
		ledger.Entities = append(ledger.Entities, Entity{ID: id, Name: name, Kind: kind, Community: sectors[group], Location: cities[group]})
	}
	addLink := func(from, to, kind string) {
		ledger.Links = append(ledger.Links, Link{ID: fmt.Sprintf("REL-%03d", len(ledger.Links)+1), From: from, To: to, Kind: kind, Status: "verified"})
	}
	for i, name := range organizations {
		id := fmt.Sprintf("ORG-%03d", i+1)
		group := i * 5 / len(organizations)
		addEntity(id, name, "company", group)
		for j := 0; j < 4; j++ {
			addLink(id, account(1+group*36+(i%2)*16+j), "registered organization")
		}
	}
	for i, name := range people {
		id := fmt.Sprintf("PER-%03d", i+1)
		group := i % 5
		addEntity(id, name, "person", group)
		addLink(id, account(1+i+group*36), "registered signatory")
	}
	for i, name := range institutions {
		id := fmt.Sprintf("BNK-%03d", i+1)
		addEntity(id, name, "bank", i)
		for j := 0; j < 36; j += 3 {
			addLink(id, account(1+i*36+j), "account institution")
		}
	}
	for i := 1; i <= 12; i++ {
		id := fmt.Sprintf("DEV-%03d", i)
		group := (i - 1) % 5
		addEntity(id, fmt.Sprintf("Device • %04d", 5800+i), "device", group)
		addLink(account(1+group*36+i-1), id, "observed device")
		if i == 1 {
			addLink(account(3), id, "observed device")
			addLink(account(5), id, "observed device")
		}
	}
	addContact := func(i int, kind, token, mask string) {
		ledger.Contacts = append(ledger.Contacts, Contact{Entity: account(i), Kind: kind, Digest: fmt.Sprintf("%x", sha256.Sum256([]byte(kind+":"+token))), Masked: mask})
	}
	for _, i := range []int{1, 3, 5} {
		addContact(i, "IP range", "documentation-net-a", "198.51.100.••")
	}
	for _, i := range []int{3, 5} {
		addContact(i, "phone", "synthetic-0192", "••• ••• 0192")
	}
	for _, i := range []int{42, 45, 49, 51} {
		addContact(i, "IP range", "documentation-net-b", "203.0.113.••")
	}
	rates := map[string]float64{"USD": 1, "EUR": 1.08, "GBP": 1.27, "KZT": 0.002, "SGD": 0.74}
	currencies := []string{"USD", "USD", "USD", "EUR", "GBP", "KZT", "SGD"}
	add := func(id string, from, to int, usd float64, currency, kind string, at time.Time) {
		native := math.Round(usd/rates[currency]*100) / 100
		ledger.Transactions = append(ledger.Transactions, Transaction{ID: id, From: account(from), To: account(to), Amount: native, Currency: currency, USD: math.Round(native*rates[currency]*100) / 100, Kind: kind, Time: at})
	}
	for i := 1; i <= 10420; i++ {
		from := random.Intn(180) + 1
		group := (from - 1) / 36
		to := random.Intn(36) + group*36 + 1
		if random.Intn(100) < 13 {
			to = random.Intn(180) + 1
		}
		for to == from {
			to = random.Intn(36) + group*36 + 1
		}
		usd := math.Min(14500, 65+math.Exp(random.NormFloat64()*0.92+6.6))
		at := DemoStart.Add(time.Duration(random.Int63n(int64(29*24*time.Hour))) + time.Duration(random.Intn(11))*time.Hour)
		kind := []string{"wire", "ACH", "card settlement", "internal transfer"}[random.Intn(4)]
		add(fmt.Sprintf("TX-%05d", i), from, to, usd, currencies[random.Intn(len(currencies))], kind, at)
	}

	at := DemoStart.Add(29*24*time.Hour + 14*time.Hour + 22*time.Minute)
	rapid := []struct {
		from, to int
		amount   float64
		minute   int
	}{
		{2, 1, 162000, 0}, {10, 1, 80600, 2}, {1, 3, 74800, 5}, {1, 4, 62700, 7}, {1, 5, 56100, 8}, {1, 8, 44900, 9},
		{3, 6, 72100, 12}, {4, 6, 60900, 14}, {5, 7, 54700, 16}, {8, 7, 42600, 18}, {6, 9, 129000, 21}, {7, 9, 94600, 23},
	}
	for i, t := range rapid {
		add(fmt.Sprintf("TX-%05d", 10421+i), t.from, t.to, t.amount, "USD", "wire", at.Add(time.Duration(t.minute)*time.Minute))
	}
	cycle := []int{42, 45, 49, 51, 42}
	for i := 0; i < len(cycle)-1; i++ {
		add(fmt.Sprintf("TX-%05d", 10433+i), cycle[i], cycle[i+1], 38000-float64(i*500), "EUR", "wire", at.Add(-2*time.Hour+time.Duration(i*5)*time.Minute))
	}
	for i := 0; i < 7; i++ {
		add(fmt.Sprintf("TX-%05d", 10437+i), 84, 85+i, 9500+float64(i*52), "USD", "wire", at.Add(-5*time.Hour+time.Duration(i*3)*time.Minute))
	}
	for i := 0; i < 6; i++ {
		add(fmt.Sprintf("TX-%05d", 10444+i), 124, 132+i, 6000+float64(i*1200), "KZT", "internal transfer", at.Add(-8*time.Hour+time.Duration(i*45)*time.Second))
	}

	muleID := 10450
	for i, episode := range []struct {
		source int
		time   time.Time
	}{
		{147, at.Add(-48*time.Hour - 36*time.Minute)},
		{150, at.Add(-36 * time.Minute)},
	} {
		amountChange := float64(i * 500)
		add(fmt.Sprintf("TX-%05d", muleID), episode.source, 148, 33600+3*amountChange, "USD", "wire", episode.time)
		muleID++
		for j, route := range []struct {
			via, destination int
			usd              float64
			transit          time.Duration
		}{
			{149, 166, 13800, 8 * time.Minute},
			{154, 166, 10800, 12 * time.Minute},
			{155, 170, 8200, 15 * time.Minute},
		} {
			split := episode.time.Add(time.Duration(3+j*2) * time.Minute)
			add(fmt.Sprintf("TX-%05d", muleID), 148, route.via, route.usd+amountChange, "USD", "wire", split)
			add(fmt.Sprintf("TX-%05d", muleID+1), route.via, route.destination, route.usd+amountChange-200, "USD", "wire", split.Add(route.transit))
			muleID += 2
		}
	}

	sort.Slice(ledger.Transactions, func(i, j int) bool { return ledger.Transactions[i].Time.Before(ledger.Transactions[j].Time) })
	return ledger
}
