# FFBI Financial Intelligence

FFBI is a financial investigation platform that analyzes imported bank transfers. Analysts can use a 3D network to trace confirmed transfers, review evidence behind a finding, test a hypothetical change, and export a case for review. Set `ORBIT_BRAND` to rename the application.

## Start with Docker Compose

From this directory, with Docker and Compose installed:

```sh
cp .env.example .env
docker compose up --build
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080). The first launch starts with an empty ledger and creates the PostgreSQL schema. Compose exposes only the frontend, bound to loopback. `docker compose down` stops the stack and retains its named database volumes. `ORBIT_PORT` changes the local frontend port.

## Deploy on a Railway VM

Use an SSH-accessible Railway VM with Docker Engine and Docker Compose 2.24.4 or newer. The [free preview VM](https://railway.com/free-vm) is temporary. Railway proxies its HTTPS URL to the VM's `$PORT`.

Copy the source to the VM and create a new `.env` there with mode `600`. Set `ORBIT_ORIGIN` to the VM's HTTPS preview URL without a trailing slash. Set `ORBIT_POSTGRES_PASSWORD` and `ORBIT_NEO4J_PASSWORD` to separate values generated with `openssl rand -hex 24`. Set `ORBIT_CORPORATE_DOMAIN`, `ORBIT_SMTP_ADDR`, and `ORBIT_SMTP_FROM` for the bank. Use an SMTP relay with STARTTLS and add `ORBIT_SMTP_USERNAME` and `ORBIT_SMTP_PASSWORD` if the relay requires authentication. Use storage dedicated to this bank. See `.env.example`.

```sh
docker compose -f compose.yaml -f compose.railway.yaml up --build --wait --wait-timeout 300
```

Open the Railway URL, choose **Register**, and confirm the code sent to your corporate inbox. The deployment publishes the frontend on `$PORT` (8080 by default). PostgreSQL, Neo4j, analytics, and the Go API use the internal Docker network.

On a Railway VM that serves `/app/index.html` while waking, use `frontend/railway-wake.html` as that fallback page. It retries until the FFBI API responds and then opens the sign-in page.

For a sign-in-only deployment, set `ORBIT_REGISTRATION_DISABLED=true` with secure cookies, `ORBIT_LOCAL_TEST=false`, and the account domain. SMTP credentials are optional in this mode. Provision existing users with `ORBIT_USERS` and unique passwords. New users created by an administrator remain pending until registration is re-enabled.

## Run without Docker

The local mode requires Go 1.24+ and Node.js 22+. It persists the ledger, cases, and audit records in a local directory. Open two terminals at the project root.

```sh
cd backend
go run ./cmd/orbit
```

```sh
cd frontend
npm ci
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The API binds to port 8081. The default data directory is `backend/.orbit` when launched as above. Set `ORBIT_DATA_DIR` to isolate a test run.

Python is optional in local mode. To enable model scoring and Louvain community discovery, run these commands in a third terminal from the project root, then start or restart the Go API with `ANALYTICS_URL=http://127.0.0.1:8090`.

```sh
cd analytics
python3.14 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8090
```

## Learn in the app

On your first visit, choose **Start Interactive Tour** or **Skip Introduction**. The guide stays open beside the live application on desktop and below it on smaller screens. Use **Help** to search topics, open the glossary, switch explanation levels, or resume either walkthrough. **Explain a control** lets you select an annotated button or metric to read its explanation. The question-mark buttons open the relevant topic directly.

The interface and product guide support English, Russian, and Kazakh. Select the language in the top bar or in the guide preferences. Your choice, explanation level, and guide progress are stored in your browser. Restart the tour in **Settings** under **Guide preferences**.

## Import and review bank transactions

1. Open **Data Sources**, choose a CSV or JSON file, and select **Import and analyze**. The interface displays the number of new transactions and current findings and links to the graph and Anomaly Radar.
2. Open a finding in **Anomaly Radar** and review its detection rule and linked transaction references. Use **Play flow** to inspect the transfer sequence in UTC.
3. Save the finding, notes, and source references to a case. Use **Simulation Lab** to compare a hypothetical graph change and export the case as PDF or JSON.

Use these fields for CSV or for objects in the JSON `transactions` array:

| Field | Format |
| --- | --- |
| `id` | Stable, unique transaction ID |
| `from`, `to` | Stable, pseudonymized sender and receiver IDs |
| `amount`, `currency` | Positive decimal amount and supported currency code (USD, EUR, GBP, KZT or SGD) |
| `usd` | Bank-supplied USD equivalent. Optional for USD, where it defaults to the original amount |
| `kind` | Transfer type from the export |
| `time` | ISO 8601 timestamp with a timezone, such as `2026-11-01T10:30:00+05:00` |

CSV uses a header, a comma delimiter, and a decimal point. IDs allow 1–40 ASCII letters, digits, periods, underscores, hyphens or colons and start with a letter or digit. The service creates account nodes from the transfer endpoints, stores up to 50,000 transactions per workspace, and accepts up to 2,000 transactions per upload. Identical transactions can be retried safely. A conflicting ID or invalid row rejects the batch.

## Analyst access

The local stack starts with an empty ledger and includes a preset test analyst.

- Email: `analyst@northstar.example`
- Password: `FFBI-Local-Analyst-2026!`

When running the API directly on its default loopback address, you can also register with any unused fictional address ending in `@northstar.example`. On the sign-in screen, choose **Register**, request the code, and choose **Open test inbox**. Enter the displayed code and your password to create a local analyst. The code stays in the API process for up to ten minutes, and the account is saved in the local workspace. Set `ORBIT_LOCAL_REGISTRATION=false` to hide the test inbox. When binding to a different loopback port, set `ORBIT_LOCAL_TEST=true` and `ORBIT_LOCAL_REGISTRATION=true` to enable it.

For local account management or case review, provision a separate `senior analyst`, `administrator`, or `platform administrator` in `backend/.orbit/local-users.json`. Use the same JSON array format as `ORBIT_USERS`, an unused `@northstar.example` address, and a unique password of 12–72 bytes. The local API reads this file on startup when using file-backed storage and no `ORBIT_USERS` override. Keep it private. The reviewer can open a case in review, enter a conclusion, and select **Complete review**.

### Account management

The platform administrator creates bank administrator accounts in **Account management**. A bank administrator creates senior analysts in **Settings**, and a senior analyst creates analysts there. Add the recipient's email to create an account awaiting activation. The recipient then uses **Register** on the sign-in screen and verifies that address to set their own password. In local mode, use the test inbox. Self-registration without a reserved role creates an analyst.

Provision the initial platform administrator with role `platform administrator` in `ORBIT_USERS` or the loopback-only `local-users.json`. The existing `administrator` role is displayed as **Bank administrator**. The platform administrator sees all bank administrators, senior analysts, and analysts in the workspace. Bank administrators see all senior analysts in their bank, while senior analysts see the analysts they created. The directory shows active and pending accounts plus per-user case and review counts. The platform administrator manages accounts, and the bank administrator and senior analysts can review investigation cases. Each API instance uses one bank workspace.

The local account is for the loopback workspace and the address is fictional. Bank deployments use `ORBIT_LOCAL_TEST=false`, HTTPS, secure cookies, a single allowed corporate domain, and an SMTP relay. Analysts create their own passwords after verifying an eight-digit code from their inbox. Use optional `ORBIT_USERS` to provision platform administrators, bank administrators, senior analysts, or auditors with email addresses on the same domain. Auditors have read-only access. Sessions expire after eight hours or on API restart.

Use a dedicated database or data directory per organization. The API binds each workspace to its configured domain or local test mode. Existing demo ledgers and cases are outside the active workspace. For bank deployments, keep data services inside the bank environment and configure per-client rate limiting at the proxy edge. Keep the optional external AI intent router disabled unless the bank authorizes sending question text to the configured provider.

## Architecture

- **Go API** owns ingestion, detection, temporal slices, path queries, simulations, report exports, and role checks. Its immutable ledger snapshot lets reads run during a validated rebuild. Browser clients receive ledger revision events over SSE.
- **PostgreSQL** persists the ledger and case records as atomic JSONB documents and stores audit events in a relational table. A single API process coordinates writes. Local mode uses atomic file replacement and an append-only audit file.
- **Neo4j** is a rebuildable projection of entities, confirmed source links, and directional transfer aggregates. The ledger and the Go query engine drive the investigation UI. Projection failures are logged and the projection is rebuilt on service startup and ledger reload.
- **Python analytics** runs an Isolation Forest over nine account features. The API combines model percentile with rules, graph analysis, and robust peer comparison and shows observed feature deviations. Louvain uses transaction counts as edge weights. Go supplies robust statistics and weighted label propagation when Python is unavailable.
- **AI Investigator** answers greetings and questions about using FFBI locally, redirects unrelated requests, and runs supported ledger queries in Go to produce evidence-backed answers. Reports distinguish verified ledger records, algorithmic findings, hypotheses, and analyst conclusions. The optional provider sees the question text for intent routing when `ORBIT_LLM_BASE_URL`, `ORBIT_LLM_MODEL`, and `ORBIT_LLM_API_KEY` are configured. Without a provider, the deterministic classifier and evidence templates cover the built-in questions.
- **React and WebGL** render a bounded neighborhood with React Three Fiber, Drei camera controls, and a camera-projected label layer. Graph layout uses community or category anchors, collision repulsion, and relationship springs. The overview initially renders 38 entities. Each expansion adds at most eight neighbors, with 150 nodes and at most four rendered edges per requested node allowed per query. Shared geometry, capped pixel density, and a keyboard-friendly list bound rendering cost. TanStack Query caches API responses and Zustand holds investigation context.

## Evidence and scope

The test generator defines normal activity alongside injected layered transfers, a time-ordered loop, near-sized transfers, a counterparty burst, repeated money mule routes, and shared infrastructure. Automated tests hold the expected scenario identities separately. Detectors use only the actual ledger and observed features. Confidence and anomaly scores rank review leads. The estimate is a seven-day exponential smoothing baseline. Account and network inference scores are uncalibrated. Fixed synthetic conversion rates support gross USD-equivalent comparisons, which can include repeat movements across hops. Forecast intervals describe recent residual error.

The money mule rule looks for two distinct incoming credits that are each followed by distributions through at least two of the same intermediary accounts to the same respective downstream recipients. Each observed hop follows the preceding credit within 30 minutes. The matching outgoing amounts must represent 60–115% of the relevant incoming amount in USD equivalent. A newer credit ends the matching window. The rule uses transfer records for review and requires separate evidence for ownership, origin of funds, or cash withdrawals.

Scenarios compare weak connectivity over the finding's verified references and look for a surviving time-ordered route between the original endpoints. The graph also shows surrounding context. The MVP uses explicit API limits, one Go instance, corporate email verification, and structured evidence references. Enterprise SSO, attachments, distributed coordination, and model calibration remain outside this implementation.

## Verification

```sh
cd backend
go test ./...
go vet ./...
```

```sh
cd analytics
python -m unittest -v
```

```sh
cd frontend
npm ci
npm run build
```

The backend integration suite checks corporate registration, durable login, CSV ingest, findings with evidence, safe retries, and auditor permissions. Run `npm run test:e2e` against a local stack with a fresh `ORBIT_DATA_DIR`; the browser test imports four fixture transfers. Set `ORBIT_TEST_URL` to target a different local frontend and `ORBIT_TEST_CHROME_CHANNEL=chrome` to use an existing Chrome installation. Install Chromium with `npx playwright install chromium` for the default browser. The older browser fixtures in `frontend/tests` cover the retired demo workflow.
