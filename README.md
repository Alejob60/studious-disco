# 🎯 Atelier Predict

## ⚡ One-Liner

**Atelier Predict forecasts retail demand 14 days ahead with a statistical model that proves it beats a naive baseline (7.77% vs 10.17% WAPE on held-out data), then hands that forecast to a Claude agent on Amazon Bedrock that turns predictions into campaigns and reorder actions — with a human approving.**

---

## 🎬 Live Demo

### **[https://main.d28ukybtuih8pa.amplifyapp.com](https://main.d28ukybtuih8pa.amplifyapp.com)**

> **Note for AWS judges:** this is not a mockup. The page calls a live serverless API
> (`https://il67zr1fr5.execute-api.us-east-1.amazonaws.com`) that runs a Holt-Winters
> forecast and invokes Claude on Bedrock on every request. A badge in the hero tells you
> which mode you are in — **"Live data · AWS"** or **"Demo mode"** — so you always know
> whether you are looking at real computation.
>
> Available in **Spanish** (`/es`) and **English** (`/en`).

---

## 🩺 The Problem

Retailers and public entities run marketing on instinct:

- ❌ **Spray-and-pray messaging** — 30,000 messages hoping 5% respond
- ❌ **No demand forecast** — stock out or overstock based on gut feeling
- ❌ **Unverifiable AI claims** — nobody can prove a model's accuracy before trusting it
- ❌ **Dashboards that lie** — numbers that were typed into a constant, not computed

**Result:** overspent budgets, stockouts on the exact days that mattered, and AI
projects nobody trusts because the accuracy claim has no evidence behind it.

---

## 💡 What We Built

### 📊 1. A forecast that has to prove itself

Additive **Holt-Winters** triple exponential smoothing with weekly seasonality
(`m=7`), fitted over 90 days of history, projecting 14 days ahead with 95%
confidence bands.

The differentiator is not the model — it is that **we score it against a baseline
on data it never saw:**

| Metric (14-day holdout) | Our model | Seasonal-naive baseline | Improvement |
|---|---|---|---|
| **WAPE** | **7.77 %** | 10.17 % | **23.6 % better** |
| **MAE** | **13.97 units/day** | 18.29 units/day | **4.32 fewer wrong units/day** |

Every one of those numbers is produced by the deployed code, reproducible from a
seed, and asserted in `backend/test/forecast-engine.test.js`.

### 🤖 2. An agent that reasons over numbers it did not produce

Claude Sonnet 4.5 via Amazon Bedrock, called with the Converse API and **tool use**
(`activate_campaign`, `adjust_reorder_point`).

The forecast is injected into the system prompt as **ground truth**. The model
therefore *cannot* invent demand figures — it narrates and acts on statistics it
did not calculate. It also **stops and asks for confirmation** rather than firing
campaigns on its own:

> **Agent:** "I detect a demand spike for Saturday. Should I activate the WhatsApp
> campaign for that day?"
> **You:** "Yes, optimise the send to maximise revenue."
> **Agent:** *(calls `activate_campaign`)* → "Campaign activated · WhatsApp"

Tool arguments are **clamped before they leave the Lambda** — model output is
untrusted input. If the model hallucinates a channel, it falls back to `whatsapp`;
if it omits an audience, the field is dropped rather than fabricated as `1`.

### ✅ 3. Engineering you can audit in one command

The part we care about most: **the claims above are machine-checked against the
deployed system.**

```bash
npm run verify:integration   # 61 checks: live site ↔ live API, deep links, the lab, the ledger, the data diagnostics
npm run verify:api           # 28 checks: API contract the UI depends on
npm run test:backend         # 147 unit tests
npm run typecheck            # TypeScript, strict
```

Total: **236 automated checks.**

### 🌍 4. Bilingual and legible to both humans and agents

- Full **es / en** with locale-prefixed routes, no hardcoded copy
- The root URL opens in the reader's own language, detected from the browser's
  preference order. An explicit `/es` or `/en` always wins, so a shared link and
  the language switcher are never overridden
- The agent replies in the language of the interface
- `/llms.txt`, `/robots.txt`, `/sitemap.xml` (11 URLs with hreflang), JSON-LD,
  per-route canonical — so language models and crawlers can read the site properly

### 🔬 5. Score your own data, and keep the result

Everything above runs on a synthetic series. That is honest, but it leaves a
reviewer nothing to push back on, so the page also accepts the visitor's own
data:

- **Download a CSV** of a neighbourhood shop's demand, 28 weeks of weekly rhythm,
  payday bumps and a Christmas spike — or upload your own file
- **Edit it in place.** Changing a number and re-running shows the effect
  immediately, which a file picker alone would not
- **The same engine scores it.** `buildForecastReport()` is the function that
  produces the 7.77 % above, run on your series instead of ours. There is no
  second implementation written for the demo

```
The sample scores 10.40 % WAPE against a 14.32 % seasonal-naive baseline
(27.40 % better) — in the same range as the dashboard's synthetic figure, not a
suspiciously better one.
```

Spreadsheet exports are not clean arrays, and reading `1.234` as `1234` produces
a confidently wrong forecast with nothing to indicate otherwise. So the delimiter
decides how the decimal mark is read — a semicolon means a locale that writes
`1.234,50` — and ambiguous forms are refused rather than guessed. A rejection
names the line and the problem. Dates are read day-first, because every locale
that writes slashes means day-first, and misreading a Colombian export would
scramble the weekly seasonality the model depends on.

#### The data is inspected before it is scored

This is the part that matters commercially, and the failure it prevents is silent.

A retailer's export contains days when the shelf was empty and nothing was sold,
days the store was shut, and promotions nobody mentioned. Feed those to a model
and it learns "those weekdays are quiet", then under-forecasts from then on.
**Nothing throws and the WAPE still looks respectable.** That is how a demand
forecast quietly becomes wrong.

So the series is inspected first and the findings ship with the score. A run of
zero days is named as a possible stock-out with its dates, gaps in the calendar
are found when the file carried them, and promotion-sized spikes are called out at
low severity. **Nothing is imputed** — a number we quietly fix is a number nobody
can reproduce — and the score is still shown, because hiding it would hide the
problem. What changes is the claim: the panel says the WAPE should not be read as
model quality on clean data.

There are two sample files, and the difference is the demonstration:

| | WAPE | Reported as |
|---|---|---|
| **`sample-demand.csv`** — a clean POS export | 8.88 % | trustworthy |
| **`sample-demand-real.csv`** — same shop, two stock-outs, a closure week, two promotions | **9.42 %** | **not trustworthy**, three zero-runs named |

The score gets *worse* with the disruptions, which is the honest result, and the
diagnostics say why. The integration suite asserts both: that the disrupted file
comes back untrustworthy with a high-severity finding, and that it scores worse
rather than better.

**Every evaluation is recorded** in a MongoDB Atlas cluster already running in
this account, in its own `atelier_predict` database, with a 90-day TTL index so
the database expires the data without a cron function. Reaching Atlas over its
public endpoint is why this needed no VPC, no NAT gateway and no new database. If
Atlas does not answer, the metrics are still returned and the page says so — the
write is best-effort, and the claim is never stronger than what happened.

That record is the seed of the phase-two dashboard: a customer cannot be shown
how their own accuracy moved over time until someone stored it.

#### The ledger

Right under the lab, the page reads those records back and shows them:

| | |
|---|---|
| **Evaluations** | how many series have been scored |
| **Beat the baseline** | the share where the model actually had less error |
| **Average WAPE** | the model's, against the baseline's |
| **Improvement range** | worst series to best |

The aggregates are computed **in MongoDB across every stored document**, not by
averaging in the Lambda — pulling them all over the wire to divide them here
would be the wrong shape. The share that beat the baseline is the number worth
having: any single WAPE flatters the model that produced it.

The endpoint is public, so it returns measurements only. The uploaded series and
its projection never come back out, and the integration suite asserts that rather
than trusting it.

It is captioned a **ledger, not a trend**, and the caption is chosen from the data
rather than asserted. The sample CSV is anchored to its build date, so a rebuild
shifts the weekdays its weekly multipliers land on and the same file measures
differently — the stored records already contain both 10.40 % and 8.88 % for it.
A caption that is sometimes false would be worse than none.

---

## ☁️ AWS Architecture

Thirteen AWS services, each doing a job that requires it. The challenger pipeline (EventBridge, App Runner, ECR) is billed continuously and is called out below:

```
Browser (Amplify Hosting, static SPA · 142 kB gzip initial)
  │
  ├── GET  /forecast ──► atelier-predict-forecast  (512 MB / 10 s)
  │                        Holt-Winters + backtest. No AWS calls at all.
  │                        If FORECAST_BUCKET is set it prefers a fresh
  │                        TimesFM record from S3 and falls back to the
  │                        champion on anything missing or stale.
  │
├── POST /chat ──────► atelier-predict-agent     (1024 MB / 28 s)
  │                        Bedrock Converse + tool use
  │                        IAM: bedrock:InvokeModel on ONE model
  │
  ├── POST /evaluate ───► atelier-predict-evaluate  (512 MB / 30 s)
  │                        same engine, the visitor's own CSV
  │                        IAM: secretsmanager:GetSecretValue on ONE secret
  │                                 │
  │                                 ▼
  │                   MongoDB Atlas → atelier_predict.evaluations
  │                   (cluster already in this account, over its public
  │                    endpoint: no VPC, no NAT, no new database)
  │
  └── POST /lead ──────► atelier-predict-lead      (512 MB / 25 s)
                           Resend, key read at runtime from Secrets Manager
                           IAM: secretsmanager:GetSecretValue on ONE secret
                                    │
                                    ▼
                    enterprise@colombiatic.com.co  (tagged: atelier-predict-hackathon)

Deployed, in a separate stack so the champion path stands alone:

EventBridge (04:30 UTC) ──► atelier-predict-batch ──► App Runner
                                                         TimesFM 2.5
                                                          │
                          forecast.json ◄──────────────────┘
                                │
                                ▼
                  forecast Lambda reads it if fresh
```

| Service | Role |
|---|---|
| **Amplify Hosting** | Static SPA hosting |
| **Lambda** (×5) | Forecast, agent, evaluation, lead capture, nightly batch orchestrator |
| **API Gateway** | HTTP API with CORS restricted to the deployed origin, routes, integration timeouts |
| **Amazon Bedrock** | Claude Sonnet 4.5 via cross-region inference profile |
| **Secrets Manager** | Resend API key and the Atlas URI, fetched at runtime — never in the function config |
| **MongoDB Atlas** | Stores each real-data evaluation. Reuses a cluster already in this account; its own database, 90-day TTL |
| **S3** | Lambda artifacts plus the nightly `forecast.json` (public access fully blocked) |
| **EventBridge** | One 04:30 UTC schedule that refreshes the challenger |
| **App Runner** | Runs the foundation-model container. **Billed while it exists: ~$120–180/month.** In maintenance mode — see the note below |
| **ECR Public** | The model image. Public because this App Runner API cannot authenticate a private one |
| **CloudWatch** | JSON logs, 14-day retention |
| **IAM** | Least-privilege role per function |
| **CloudFormation** | Two stacks, each reproducible from one template |

**This is not a wrapper around a hosted API.** Every number on the page is computed
in a Lambda you can read, deploy with one command, and audit with two roles that
cannot touch anything they do not need.

> **Known platform risk: App Runner is in maintenance mode.** AWS stopped
> accepting new customers on 30 April 2026 and states it will add no further
> features. Existing customers keep working, and we can still create services —
> this one was created in October, after that date — so **nothing needs to change
> for the hackathon**, and no sunset date has been announced. It is recorded here
> because it is the one service we depend on that AWS has signalled it is winding
> down, and for the commercial phase AWS's own recommendation is ECS Express Mode.
> The champion path does not depend on it: if the challenger is switched off,
> `/forecast` falls back to Holt-Winters and the dashboard is unaffected.

---

## 🧠 Technical Innovation

### 1. An auditable benchmark instead of an accuracy claim

Most demos assert accuracy. We *prove* it: the model is scored against a
seasonal-naive baseline on a 14-day holdout, and the savings figure is **derived
from that backtest** rather than invented:

> 4.32 fewer wrong units per day × 30 days × USD 4.60 contribution margin
> = **USD 596 / month of inventory savings**

Change the assumption, and the number changes — because it is arithmetic, not
marketing. The margin is an input in `buildForecastReport()`, documented as an
assumption to replace with the client's real number. It is USD 4.60 precisely
because that is a whole number of cents: the sum above is the figure on the page,
to the dollar, with nothing left to convert.

### 2. Grounded agency, not generative guessing

The agent's most important property is what it *cannot* do: it cannot invent
demand. The statistical layer owns the numbers; the LLM owns the language and the
actions. A wrong forecast is a statistics bug, traceable and fixable — not a
hallucination buried in a chat log.

### 3. Supply-chain honesty as a feature

`verify:integration` asserts that the bundle Amplify is *currently serving* points
at the API that is *currently running*. Most demos never check that their deployed
artefact matches their intent. Ours fails the build if it drifts.

---

## 📊 Market Impact — With Receipts

We are deliberately **not** publishing customer case studies we cannot evidence.
Here is the value proposition with the numbers we can actually defend:

| Claim | Evidence |
|---|---|
| The model beats a naive baseline | 7.77% vs 10.17% WAPE, 14-day holdout |
| Fewer forecasting errors | 13.97 vs 18.29 units/day MAE |
| Inventory savings | USD 596/month, derived from that backtest |
| Pipeline is real | 236 automated checks against the deployed system |
| The agent acts, not just answers | Tool calls executed and clamped server-side |

**Target market:** SMBs and municipal tax offices in Colombia and Latin America.
We have conversations in progress and will publish named results only when they
are signed.

---

## 🤖 Coding Agent Proof

The infrastructure, backend and frontend in this repository were built with an AI
coding agent working against a live AWS account.

**📹 Session recording:**
[docs/amazon-q-infra-terraform.mp4](docs/amazon-q-infra-terraform.mp4)
([raw download](https://github.com/Alejob60/studious-disco/raw/main/docs/amazon-q-infra-terraform.mp4))

> The recording is named after the session it came from. For the record: the
> infrastructure in this repo is **CloudFormation** (`infra/template.yaml`), not
> Terraform — there is no `.tf` file in this repository.

**What the agent built end-to-end:** CloudFormation template with three
least-privilege IAM roles, three Lambda handlers, an HTTP API with CORS, a
Bedrock agent with tool use and adaptive retries, a Resend integration reading
its key from Secrets Manager, plus a React dashboard with a lazy-loaded chart, a
bilingual router and four legal pages.

Every deployment is scripted in `infra/deploy.ps1` and reproducible from a clean
checkout.

---

## 🗺️ Judge's Guide: Experience the Demo

**Happy path, ~4 minutes.**

### Step 1 — Verify it is live (30 s)
Look at the badge in the hero. It must read **"Live data · AWS"** in green.
If it says "Demo mode", the API is unreachable and the page fell back to bundled
data — the UI tells you rather than hiding it.

### Step 2 — Read the KPI cards (30 s)
- **Demand forecast (7 days):** a computed sum of the projection
- **Inventory savings:** the backtest-derived figure
- **Model precision (WAPE):** 7.77% — the same number in our table above

### Step 3 — Inspect the forecast chart (30 s)
- Grey line: **21 days of actuals**
- Gold line with gradient: **14 days of projection**
- Dashed gold divider: the boundary between what happened and what is expected
- **Click the legend** to toggle either series — the labels are a real control
- Hover any point for the exact value
- Hover **each** forecast point: the tooltip shows the value; the band is ±1.96σ

### Step 4 — Interact with the agent (90 s)
1. Ask: *"Which day should I stock up, and should I act on it?"*
   → It cites the real peak and its WAPE.
2. Say: *"Yes, activate the WhatsApp campaign for that day."*
   → Watch it **call the tool**. The chip under the reply reads
   *"Campaign activated · WhatsApp"*.
3. Try switching the language to **EN** and repeat. The agent answers in English.

### Step 5 — Check the engineering (60 s)
```bash
git clone https://github.com/Alejob60/studious-disco && cd studious-disco
npm install
npm run verify:integration \
  https://main.d28ukybtuih8pa.amplifyapp.com \
  https://il67zr1fr5.execute-api.us-east-1.amazonaws.com
```
61 checks against production, from your own machine.

### Step 6 — Score your own data (90 s)
1. Scroll to **"Try it on your data"** and press **Load the sample series**
2. Press **Evaluate my series**
3. Read the two WAPEs: the model's and the naive baseline's, both measured on the
   same 14 days it never saw. The sample lands at 10.40 % against 14.32 %
4. Now change a number in the textarea and press it again. The number moves
5. The line underneath says the evaluation was **stored**, with an id and the
   retention window
6. Keep scrolling to **"Everything we have measured"** — that is the same
   database read back, aggregated by MongoDB. Refresh it: the row you just created
   appears without a reload

### Step 7 — The legal and agent surface (30 s)
Open `/llms.txt`, `/en/privacy`, and the **cookie consent banner**. Four
jurisdictional policies in two languages, and a site an external agent can read.

---

## 📋 Tags

- **App Category:** `#commercial-potential` · `#data-and-analytics`
- **Lane:** `#startups`

---

## 🚀 Roadmap

### ✅ Phase 1 — Shipped (this hackathon)
- Static SPA on Amplify Hosting, bilingual, opening in the reader's own language
- Holt-Winters forecast with seasonal-naive backtest — **deployed and scoring**
- Claude agent on Bedrock with validated tool use — **deployed**
- **Real-data lab**: download a CSV, edit it, have the same engine score it, and
  keep the evaluation in MongoDB Atlas with a 90-day TTL
- Lead capture to `enterprise@colombiatic.com.co`, tagged by origin
- Four legal policies in two languages, cookie consent, agent-readable surface
- Every sitemap route served as a real page, not a rewrite the CDN ignored
- 236 automated checks against production

### 🔜 Phase 2 — Commercial build *(first slice shipped above)*
- **The control dashboard.** The aggregate ledger above is the first piece; what
  remains is per-customer accuracy over time, champion against challenger side by
  side, and the agent's actions logged instead of firing and forgetting
- Multi-tenancy on top of the existing collection — customers, SKUs and series
- Authentication on `/chat` and `/lead` (Cognito or API key)
- Streaming agent replies (`ConverseStream`) to cut time-to-first-token
- Lead pipeline beyond email: status, notes, export
- IAM deploy role replacing the root credentials used so far

### 🧪 Evaluated — TimesFM 2.5 vs our champion

We benchmarked Google's time-series foundation model against our Holt-Winters
implementation on the **same 14-day holdout**, with the same metric:

| Model | WAPE | MAE (units/day) |
|---|---|---|
| seasonal-naive (baseline) | 10.17 % | — |
| Holt-Winters (our champion) | 7.77 % | 13.97 |
| **TimesFM 2.5 (challenger)** | **5.61 %** | **10.10** |

**The challenger won by 2.15 points of WAPE (27.7 % relative).**

It costs seconds of CPU inference against our 1 ms, so we are not putting it on
the synchronous path. Measured in the actual container on 4 CPUs: **6-12 s**,
with the model taking ~150 s to load at startup. That is exactly why it cannot
share the request path, and why it runs on a nightly schedule instead: the
stored forecast is served from the same fast endpoint, so the user gets the
foundation model's accuracy at the champion's latency.

Reproduce it yourself:

```bash
node scripts/export-benchmark-dataset.mjs
.venv-tfm/Scripts/python benchmarks/timesfm_benchmark.py
```

TimesFM weights up to 2.5 are Apache-2.0 (commercial self-hosting permitted);
3.0 weights are non-commercial, so 2.5 is the newest version we can host
ourselves. Full write-up in [`benchmarks/README.md`](benchmarks/README.md).

### 🏗️ The nightly challenger pipeline — deployed and serving

`GET /forecast` returns the TimesFM result, not the champion. The App Runner
service loads the model in **1.3 s**, the batch job publishes `forecast.json`, and
the forecast Lambda prefers that record whenever it is fresh.

| Piece | Location | State |
|---|---|---|
| FastAPI inference service | [`services/timesfm/main.py`](services/timesfm/main.py) | 16/16 smoke checks, 5.61 % WAPE in-container |
| Container image | [`services/timesfm/Dockerfile`](services/timesfm/Dockerfile) | built, 1.98 GB uncompressed |
| Nightly orchestrator | [`backend/batch/index.js`](backend/batch/index.js) | bundled, tested |
| AWS stack | [`infra/template-timesfm.yaml`](infra/template-timesfm.yaml) | deployed, `CREATE_COMPLETE` |
| One-command deploy | [`infra/deploy-timesfm.ps1`](infra/deploy-timesfm.ps1) | runs green |

**It costs about $120–180/month.** App Runner bills for the time a service exists
rather than the time it is used, and it cannot scale to zero. That is a real cost
on this project, accepted deliberately for now, not an oversight. Everything the
dashboard serves still works without it.

Three decisions worth reading, because two of them are traps:

- **The challenger cannot take the endpoint down.** A fresh, well-formed
  `forecast.json` wins; anything missing, stale, hash-mismatched or malformed
  falls through to Holt-Winters. Pinned by tests, including one that sets
  `FORECAST_BUCKET` against a bundle with no S3 SDK and asserts `/forecast` still
  answers 200.
- **The champion stays fast by default.** Reading S3 pulls in the AWS SDK, which
  takes the forecast bundle from **13 KB to 2,911 KB**. So the SDK is packaged
  only when you opt in: `node scripts/bundle-functions.mjs backend out --with-s3`.
- **The image had to be made public.** This App Runner API has no `AccessRoleArn`
  parameter at all, so a private ECR image cannot be authenticated — `CreateService`
  answers `Authentication configuration is invalid`, and granting
  `apprunner.amazonaws.com` in the repository policy does not help. `ECR_PUBLIC`
  needs no role and is the only path this API supports. Two more of its limits are
  recorded in the template because they are only findable by bisecting: `Runtime`
  is rejected for every value, and `HealthCheckConfiguration` is rejected outright.

Reproduce and redeploy:

```bash
./infra/deploy-timesfm.ps1 -ImageTag 1.0.0     # builds, pushes, deploys, triggers once
./infra/deploy.ps1 -ForecastBucketName <bucket-from-the-output>
```

### 💲 Money is in USD, and only USD

This used to show a COP figure with a USD equivalent — `$599 (COP 2,395,611)` —
and a sentence that priced the margin in COP and the result in dollars. Two
currencies for one claim, and the arithmetic did not survive the round trip: COP
18,500 is USD 4.625, which rendered as **$5**, so redoing the sum from the printed
margin came out eight percent away from the printed total. On a page whose whole
argument is that the numbers can be checked, that is the one thing that must not
be wrong.

So there is one currency now, and it is chosen for arithmetic rather than for
decoration:

```
4.32 fewer wrong units/day × 30 days × USD 4.60 margin = USD 596
```

USD 4.60 is a whole number of cents, which is the point — the sum is the figure
on the page, to the dollar, with no conversion in between. The backend emits USD
because the model math was always currency-agnostic; only the presentation ever
converted, and now there is nothing to convert.

The margin remains a **stated assumption** rather than a market fact, it travels
with the figure in the payload as `unitMarginUsd`, and the interface shows it so
the reader can substitute their own.

#### Coming in phase 2: the margin in the customer's own currency

A neighbourhood shop does not think "my margin is USD 4.60" — it thinks "my
margin is 18,000 pesos". And what differs between a corner store and a chain is
**not the exchange rate; it is the margin.** So the toggle is not a currency
converter bolted on the navbar, it is a configurable input.

```
today     margin = USD 4.60 (stated)        →  USD 596
phase 2   margin = COP 18.500, currency COP  →  COP 2,397,600
```

The second line is computed natively: the customer never sees a figure that was
multiplied by a rate. An exchange rate is only shown when they ask for the USD
equivalent, and it is a dated value rather than a constant — the 4,000 COP/USD
this project used to carry was a stale assumption, and a dashboard that presents
itself as an audit trail cannot have a number that drifts with the calendar.

The seam is already in place: `unitMarginUsd` travels in the payload, so this is a
change of input rather than a refactor.

### 💡 Phase 3 — Month 2–3 *(aspiration)*
- WhatsApp Business API so `activate_campaign` reaches a real audience
- Multi-tenant architecture and per-customer model selection
- Per-customer model selection: champion by default, challenger where it wins

> **On our roadmap claims:** the items above are intentions, not achievements.
> Anything labelled *shipped* in this README is running in production right now
> and can be verified with the commands shown — including the nightly TimesFM
> job, which is deployed and serving. It is the one line item that carries a
> standing cost, ~$120–180/month, billed for as long as the App Runner service
> exists. That is a deliberate trade, not an oversight: the dashboard answers
> without it, and the section above says exactly what turns it off.

---

## 💰 Business Model

**Planned** SaaS tiers (not yet on sale):

| Tier | Price | Includes |
|---|---|---|
| Essential | USD 29 / mo | Forecasting, basic agent |
| Growth | USD 99 / mo | Advanced analytics, campaign automation |
| Pro | USD 249 / mo | Custom models, integrations |

Priced in USD throughout, like the rest of the product. The demo tier is free and
unlimited during the hackathon.

---

## 👥 Team

- **Alejandro Benavides** — CEO & Principal Architect

<!-- Add co-founders, advisors or technical leads here before submitting. -->

---

## 📞 Contact

- **Enterprise:** enterprise@colombiatic.com.co
- **Founder:** alejob600@gmail.com
- **GitHub:** [github.com/Alejob60/studious-disco](https://github.com/Alejob60/studious-disco)
- **Live app:** [main.d28ukybtuih8pa.amplifyapp.com](https://main.d28ukybtuih8pa.amplifyapp.com)

---

## 🔐 Security Posture

Named honestly, because a judge who finds these unmentioned will assume they are
hidden:

| Item | Status |
|---|---|
| IAM least privilege per function | ✅ four roles, scoped resources, one secret each |
| Secrets out of code and function config | ✅ Secrets Manager, runtime fetch |
| S3 public access | ✅ fully blocked, no bucket policy |
| XSS escaping in notification emails | ✅ tested, all lead fields escaped |
| CORS origin restriction | ✅ **only the deployed origin**; a foreign origin gets no allow-origin header, asserted by the suite |
| Uploaded-data handling | ✅ bounded to 365 points, refused when unparseable, 90-day TTL, never logged |
| Rate limiting on `/lead` | ⚠️ in-memory, per instance — moves to DynamoDB with scale |
| Authentication on `/chat` and `/lead` | ❌ **public by deliberate choice until phase 2** |
| Deploy credentials | ⚠️ root used during the hackathon; IAM role planned |

> **On leaving `/chat` open:** this is a hackathon, and an authenticated demo is
> a worse demo. The wildcard CORS that made it genuinely careless is closed, so
> no third-party page can drive the Bedrock spend; what remains is that the
> deployed site itself is unauthenticated, which is the gap phase 2 closes.

---

## 🏆 Why This Should Win

1. **The accuracy claim is falsifiable.** A holdout backtest against a baseline,
   with the arithmetic in the repo and the tests that assert it.
2. **The agent cannot hallucinate demand.** Statistics own the numbers, the LLM
   owns the language and the actions.
3. **The claims are machine-checked.** 236 automated checks run against the
   deployed system, not against a local build.
4. **The deployment is reproducible.** One script, one CloudFormation template,
   from clean checkout to live URL.
5. **The submission is honest.** Roadmap is labelled roadmap. Security debt is
   listed. We publish case studies when they are signed, not before.

---

## 📄 License

Apache License 2.0 — see [LICENSE](LICENSE).

---

**Built for the AWS Zero to Shipped Hackathon 2026**

*Thank you to the AWS team for creating this opportunity.*
