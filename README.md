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
npm run verify:integration   # 28 checks: live site ↔ live API
npm run verify:api           # 29 checks: API contract the UI depends on
npm run test:backend         # 31 unit tests
npm run typecheck            # TypeScript, strict
```

Total: **88 automated checks, all green against production.**

### 🌍 4. Bilingual and legible to both humans and agents

- Full **es / en** with locale-prefixed routes, no hardcoded copy
- The agent replies in the language of the interface
- `/llms.txt`, `/robots.txt`, `/sitemap.xml` (11 URLs with hreflang), JSON-LD,
  per-route canonical — so language models and crawlers can read the site properly

---

## ☁️ AWS Architecture

Nine AWS services, each doing a job that requires it:

```
Browser (Amplify Hosting, static SPA · 142 kB gzip initial)
  │
  ├── GET  /forecast ──► atelier-predict-forecast  (512 MB / 10 s)
  │                        Holt-Winters + backtest. No AWS calls at all.
  │
  ├── POST /chat ──────► atelier-predict-agent     (1024 MB / 28 s)
  │                        Bedrock Converse + tool use
  │                        IAM: bedrock:InvokeModel on ONE model
  │
  └── POST /lead ──────► atelier-predict-lead      (512 MB / 25 s)
                           Resend, key read at runtime from Secrets Manager
                           IAM: secretsmanager:GetSecretValue on ONE secret
                                    │
                                    ▼
                    enterprise@colombiatic.com.co  (tagged: atelier-predict-hackathon)
```

| Service | Role |
|---|---|
| **Amplify Hosting** | Static SPA hosting |
| **Lambda** (×3) | Forecast, agent, lead capture |
| **API Gateway** | HTTP API with CORS, routes, integration timeouts |
| **Amazon Bedrock** | Claude Sonnet 4.5 via cross-region inference profile |
| **Secrets Manager** | Resend API key, fetched at runtime — never in the function config |
| **S3** | Versioned Lambda artifacts (public access fully blocked) |
| **CloudWatch** | JSON logs, 14-day retention |
| **IAM** | Three separate roles, least privilege |
| **CloudFormation** | Whole stack from one template, reproducible |

**This is not a wrapper around a hosted API.** Every number on the page is computed
in a Lambda you can read, deploy with one command, and audit with two roles that
cannot touch anything they do not need.

---

## 🧠 Technical Innovation

### 1. An auditable benchmark instead of an accuracy claim

Most demos assert accuracy. We *prove* it: the model is scored against a
seasonal-naive baseline on a 14-day holdout, and the savings figure is **derived
from that backtest** rather than invented:

> 4.32 fewer wrong units per day × 30 days × COP 18,500 contribution margin
> = **COP 2,395,611 / month of inventory savings**

Change the assumption, and the number changes — because it is arithmetic, not
marketing. The margin is an input in `buildForecastReport()`, documented as an
assumption to replace with the client's real number.

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
| Inventory savings | COP 2,395,611/month, derived from that backtest |
| Pipeline is real | 88 automated checks green against production |
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
28 checks against production, from your own machine.

### Step 6 — The legal and agent surface (30 s)
Open `/llms.txt`, `/en/privacy`, and the **cookie consent banner**. Four
jurisdictional policies in two languages, and a site an external agent can read.

---

## 📋 Tags

- **App Category:** `#commercial-potential` · `#data-and-analytics`
- **Lane:** `#startups`

---

## 🚀 Roadmap

### ✅ Phase 1 — Shipped (this hackathon)
- Static SPA on Amplify Hosting, bilingual (`/es`, `/en`)
- Holt-Winters forecast with seasonal-naive backtest — **deployed and scoring**
- Claude agent on Bedrock with validated tool use — **deployed**
- Lead capture to `enterprise@colombiatic.com.co`, tagged by origin
- Four legal policies in two languages, cookie consent, agent-readable surface
- 88 automated checks against production

### 🔜 Phase 2 — Next 2 weeks *(planned, not built)*
- Authentication on `/chat` and `/lead` (Cognito or API key)
- Restricted CORS to the deployed origin only
- Streaming agent replies (`ConverseStream`) to cut time-to-first-token
- Real customer CSV via the existing `POST /forecast {"history": [...]}` contract
- IAM deploy role replacing the root credentials used so far

### 💡 Phase 3 — Month 2–3 *(aspiration)*
- **Time-series foundation model** (TimeFM or equivalent) benchmarked against our
  Holt-Winters baseline on the same holdout. We will adopt it only if it wins on
  our data — and we will publish the comparison either way.
- WhatsApp Business API so `activate_campaign` reaches a real audience
- Multi-tenant architecture and per-customer model selection

> **On our roadmap claims:** the items above are intentions, not achievements.
> Anything labelled *shipped* in this README is running in production right now
> and can be verified with the commands shown.

---

## 💰 Business Model

**Planned** SaaS tiers (not yet on sale):

| Tier | Price | Includes |
|---|---|---|
| Essential | USD 29 / mo (~COP 116,000) | Forecasting, basic agent |
| Growth | USD 99 / mo (~COP 396,000) | Advanced analytics, campaign automation |
| Pro | USD 249 / mo (~COP 996,000) | Custom models, integrations |

Pricing in COP at the current reference rate of 4,000 COP/USD. The demo tier
is free and unlimited during the hackathon.

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
| IAM least privilege per function | ✅ three roles, scoped resources |
| Secrets out of code and function config | ✅ Secrets Manager, runtime fetch |
| S3 public access | ✅ fully blocked, no bucket policy |
| XSS escaping in notification emails | ✅ tested, all lead fields escaped |
| Rate limiting on `/lead` | ⚠️ in-memory, per instance — moves to DynamoDB with scale |
| Authentication on `/chat` and `/lead` | ❌ **public; planned Phase 2** |
| CORS origin restriction | ❌ currently `*`; planned Phase 2 |
| Deploy credentials | ⚠️ root used during the hackathon; IAM role planned |

---

## 🏆 Why This Should Win

1. **The accuracy claim is falsifiable.** A holdout backtest against a baseline,
   with the arithmetic in the repo and the tests that assert it.
2. **The agent cannot hallucinate demand.** Statistics own the numbers, the LLM
   owns the language and the actions.
3. **The claims are machine-checked.** 88 automated checks run against the
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