package intel

import "time"

type Entity struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Kind      string  `json:"kind"`
	Community string  `json:"community"`
	Location  string  `json:"location"`
	Masked    string  `json:"masked,omitempty"`
	Size      float64 `json:"size,omitempty"`
	Score     int     `json:"score,omitempty"`
	Position  Vec     `json:"position"`
}

type Vec [3]float64

type Transaction struct {
	ID       string    `json:"id"`
	From     string    `json:"from"`
	To       string    `json:"to"`
	Amount   float64   `json:"amount"`
	Currency string    `json:"currency"`
	USD      float64   `json:"usd"`
	Kind     string    `json:"kind"`
	Time     time.Time `json:"time"`
}

type Link struct {
	ID     string `json:"id"`
	From   string `json:"from"`
	To     string `json:"to"`
	Kind   string `json:"kind"`
	Status string `json:"status"`
}

type Contact struct {
	Entity string `json:"entity"`
	Kind   string `json:"kind"`
	Digest string `json:"digest"`
	Masked string `json:"masked"`
}

type Ledger struct {
	Entities     []Entity      `json:"entities"`
	Transactions []Transaction `json:"transactions"`
	Links        []Link        `json:"links"`
	Contacts     []Contact     `json:"contacts"`
}

type Evidence struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Status      string `json:"status"`
	Focus       string `json:"focus,omitempty"`
	Transaction bool   `json:"transaction,omitempty"`
}

type FindingCheck struct {
	Condition    string   `json:"condition"`
	Observations []string `json:"observations"`
	References   []string `json:"references,omitempty"`
}

type Finding struct {
	ID           string         `json:"id"`
	Kind         string         `json:"kind"`
	Title        string         `json:"title"`
	Summary      string         `json:"summary"`
	Score        int            `json:"score"`
	Subject      string         `json:"subject"`
	Entities     []string       `json:"entities"`
	Evidence     []Evidence     `json:"evidence"`
	Transactions []string       `json:"transactions"`
	Reasons      []string       `json:"reasons"`
	Checks       []FindingCheck `json:"checks,omitempty"`
	Start        time.Time      `json:"start"`
	End          time.Time      `json:"end"`
	USD          float64        `json:"usd"`
}

type Edge struct {
	ID           string   `json:"id"`
	From         string   `json:"from"`
	To           string   `json:"to"`
	Kind         string   `json:"kind"`
	Status       string   `json:"status"`
	Count        int      `json:"count"`
	USD          float64  `json:"usd"`
	Recency      float64  `json:"recency"`
	Transactions []string `json:"transactions"`
	Highlight    bool     `json:"highlight"`
}

type Graph struct {
	Nodes   []Entity `json:"nodes"`
	Edges   []Edge   `json:"edges"`
	Total   int      `json:"total"`
	Window  int      `json:"window"`
	Version string   `json:"version"`
}

type Bucket struct {
	Date  string  `json:"date"`
	Count int     `json:"count"`
	USD   float64 `json:"usd"`
}

type Summary struct {
	Version      string    `json:"version"`
	Transactions int       `json:"transactions"`
	Accounts     int       `json:"accounts"`
	Entities     int       `json:"entities"`
	Communities  int       `json:"communities"`
	USD          float64   `json:"usd"`
	Start        time.Time `json:"start"`
	End          time.Time `json:"end"`
	Buckets      []Bucket  `json:"buckets"`
	Findings     []Finding `json:"findings"`
	Model        string    `json:"model"`
}
