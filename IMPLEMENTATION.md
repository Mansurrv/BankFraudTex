# ORBIT implementation plan

The workspace started empty. There were no existing sources, database schemas, repository instructions, or Git metadata to preserve.

## Architecture

The Go API owns the ledger, graph queries, evidence, case permissions, and exports. It builds a bounded view from an immutable in-memory snapshot and uses PostgreSQL for persisted ledger records, cases, and audit entries in Compose. Neo4j stores a rebuildable projection of confirmed graph relationships. Compose runs a private Python analytics service with NetworkX and Isolation Forest. Its optional language model maps a question to a restricted set of investigation intents. Go executes the selected query and writes the answer from returned evidence. A local fallback supports the same query tools without credentials or Python.

React uses React Three Fiber for the scene, TanStack Query for server state, and Zustand for investigation context. The default view opens a seeded review. Analysts can go back to the overview, change layouts, navigate with the keyboard, or switch to a list.

## Delivery checklist

- [x] Foundation, Compose, schema, deterministic synthetic ledger, and app shell
- [x] 3D explorer, camera controls, progressive navigation, and contextual panels
- [x] Behavioral similarity, evidence-linked relationships, and anomaly scoring
- [x] Historical snapshots, temporal comparison, and money flow playback
- [x] Evidence-grounded investigator and deterministic fallback
- [x] Reversible what-if scenarios and before-and-after comparison
- [x] Cases, notes, evidence, review, and PDF/JSON reports
- [x] Automated tests, application verification, and setup documentation

## Interactive product guide

The app uses Zustand for navigation and investigation scope, TanStack Query for ledger and case data, and React Three Fiber for the graph. The guide will use these existing entry points and keep the investigator, simulator, and case mutations in their current components.

1. Define a typed feature registry with English and Russian dictionaries. Use it for beginner explanations, advanced details, contextual tooltips, Help Center search, and stable tour targets. Provide a locale interface for a future Kazakh dictionary.
2. Add a first-visit welcome and persistent Help entry. Store dismissal, language, detail level, and resumable step IDs in versioned browser storage. Add restart controls in Settings.
3. Build a nonmodal tour that follows the active view, spotlights real controls, and keeps them operable. Reposition on scroll and resize, restore focus when closing, and provide a readable fallback when a target is unavailable.
4. Use the synthetic Rapid Fund Dispersion finding and its transaction sequence for the ten-step demo. Open the existing account and transaction panels, story, investigator, simulator, case form, and export controls. Case creation and exports stay user-initiated.
5. Add topic search, explanatory controls, a glossary, and six interactive diagrams. Fill the few gaps needed by the teaching workflow with live dashboard counts, verified registered parties, and an optional start and end date on the graph timeline.
6. Verify localization, persistence, keyboard and mobile behavior, missing targets, original investigation features, and the demo through a real report download. Use an isolated demo data directory for smoke tests.
