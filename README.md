# Atelier Predict

MVP full-stack for the **AWS Zero to Shipped 2026** hackathon — an agentic demand
forecasting dashboard for Colombian retail.

- **Frontend:** `https://main.d28ukybtuih8pa.amplifyapp.com` (AWS Amplify Hosting)
- **Backend API:** `https://il67zr1fr5.execute-api.us-east-1.amazonaws.com` (API Gateway → Lambda → Bedrock)

## What makes this more than a dashboard

The forecast is **computed, not invented**. A statistical model fits the history
and is then scored against a baseline on held-out data, so the accuracy claim on
screen is auditable:

| Metric             | Model (Holt-Winters) | Baseline (seasonal naive) |
| ------------------ | -------------------- | ------------------------- |
| WAPE, 14d holdout  | **7.77 %**           | 10.17 %                   |
| MAE                | **13.97 unid/día**   | 18.29 unid/día            |

The headline savings figure is derived from that backtest rather than made up:
the model commits 4.32 fewer wrong units per day, priced at a COP 18.500 unit
margin over 30 days.

The agent **reasons over those numbers but never produces them**. Claude receives
the statistical output as ground truth in its system prompt, so it cannot invent
demand figures, and it can invoke `activate_campaign` / `adjust_reorder_point`
tools whose arguments are validated before being echoed to the UI.

## Architecture

```
Browser (Amplify Hosting, static SPA)
  │  GET  /forecast              POST /chat
  ▼                               ▼
API Gateway HTTP API (CORS: *)
  │                               │
  ▼                               ▼
atelier-predict-forecast    atelier-predict-agent
  │  Holt-Winters + backtest      │  Converse API + tool use
  └─ no AWS calls at all          └─ bedrock:InvokeModel
                                         only, scoped to one model
```

| Concern         | Choice                                              |
| --------------- | --------------------------------------------------- |
| Frontend        | React 19 + TypeScript, built with Vite 8            |
| Styling         | Tailwind CSS v4 (CSS-first `@theme` tokens)         |
| Charts          | Recharts 3, split into a lazy chunk                 |
| Animation       | Motion 13 (`motion/react`)                          |
| Routing + i18n  | react-router-dom with `/es` and `/en`, custom `t()`  |
| Model           | Additive Holt-Winters, weekly seasonality (m=7)     |
| LLM             | Claude Sonnet 4.5 via `us.` cross-region profile    |
| Email           | Resend HTTP API, key in AWS Secrets Manager          |
| IaC             | Plain CloudFormation (`infra/template.yaml`)        |
| Auth            | None — see [Security](#security-debt)               |

## Internationalisation

Every user-facing string comes from `src/i18n/dictionaries.ts`; no component
hardcodes copy. `t('hero.titleLead', { token })` interpolates `{token}`.

- Routes are locale-prefixed: `/es`, `/en`, plus the legal pages
  (`/es/privacidad`, `/en/privacy`, …). `/` redirects to `/es`.
- The language switcher swaps the first path segment and keeps the current page.
- The agent Lambda receives the locale and answers in the same language.
- `<html lang>` is kept in sync for screen readers.

### Languages

| Locale | Path                 | Notes                                  |
| ------ | -------------------- | -------------------------------------- |
| `es`   | `/es`                | Default. Colombian Spanish, COP amounts |
| `en`   | `/en`                | English, same layout                   |

## Getting started

```bash
npm install
npm run dev              # http://localhost:5173
```

Without `VITE_API_URL` the dashboard runs in demo mode on bundled mock data.
Copy `.env.example` to `.env.local` to point it at a live API.

```bash
npm run build            # typecheck + production build into dist/
npm run preview          # serve the production build
```

## Backend

```bash
npm --prefix backend install       # only the Bedrock SDK client
node --test backend/test/          # 10 tests for the forecasting engine
node scripts/verify-api.mjs <apiUrl>   # asserts the live API matches the UI contract
```

Deploy (no SAM or CDK CLI required):

```powershell
./infra/deploy.ps1
```

The script stages the handlers, bundles `node_modules`, uploads to S3 and applies
the stack through a change set. It prints the API URL when done.

| Endpoint     | Purpose                                                    |
| ------------ | ---------------------------------------------------------- |
| `GET /forecast` | Holt-Winters projection, 95 % bands, and the backtest   |
| `POST /chat`    | Claude over that forecast, with tool use               |
| `POST /lead`    | Hackathon contact form; notifies the team via Resend    |

`POST /forecast` also accepts `{"history": [ ... ]}` to run the model against a
real POS export instead of the synthetic demo history.

## Frontend structure

```
src/
  components/
    Header.tsx           sticky nav + AWS badge, gold hairline on scroll
    Hero.tsx             headline, CTA, live/demo data badge
    KpiCards.tsx         3 headline metrics with count-up animation
    ForecastChart.tsx    real vs. predicted area chart (lazy loaded)
    AgentChat.tsx        Bedrock conversation, falls back to canned replies
    ContactForm.tsx      hackathon lead form, honeypot + validation
    DataSourceBadge.tsx  "Datos en vivo · AWS" vs "Modo demostración"
    Footer.tsx           legal links + hackathon attribution
    legal/CookieConsent.tsx  consent banner (accept all / essential only)
    ui/                  Reveal (scroll entrance), ChartSkeleton
  content/
    legal.ts             the four policy bodies, es + en
    legal-meta.ts        slugs and labels only (keeps the bundle small)
  i18n/
    dictionaries.ts      all UI copy, es + en
    I18nProvider.tsx     t(key, vars) hook, {token} interpolation
    LanguageSwitcher.tsx  swaps the leading path segment
  lib/
    api.ts               typed client + response contracts
    useForecast.ts       load with mock fallback
    forecast-view.ts     API payload -> chart points and KPIs
  data/mock.ts           mock history + buildMockForecast()
  pages/
    LegalPage.tsx        renders one policy (lazy loaded)
```

There is a single rendering path: mock and live data have the same shape, so the
fallback exercises the real components.

## Design system

Tokens live in `src/index.css` under `@theme` and become utilities automatically.

| Token        | Value                     | Role                     |
| ------------ | ------------------------- | ------------------------ |
| `ink`        | `#050505`                 | page background          |
| `surface`    | `#161616`                 | cards and panels         |
| `surface-2`  | `#1e1e1e`                 | nested surfaces          |
| `body`       | `#A1A1AA`                 | secondary text           |
| `gold`       | `#D4AF37`                 | primary accent           |
| `gold-light` | `#F3E5AB`                 | accent gradient end      |
| `aws`        | `#2ECC71` on `#052E1B`    | AWS badge                |
| `line`       | `rgba(255,255,255,0.08)`  | hairline borders         |

## Accessibility & responsiveness

- Honours `prefers-reduced-motion`; every animation degrades to a static render.
- Keyboard-reachable chart legend, skip link, labelled chat input.
- Single column on mobile, three-column KPI grid from `lg`.

## Deploy the frontend

Amplify detects Vite automatically. Build settings:

```
Base directory:  /       (empty)
Build command:   npm run build
Output directory:dist
Runtime:         Node.js 22
```

No environment variables needed in Amplify: `VITE_API_URL` is committed in
`.env.production`. To point at a different API, set `VITE_API_URL` as an
Amplify environment variable instead and delete that file.

### Required: SPA rewrites for the i18n routes

The app uses locale-prefixed client routes (`/es`, `/en`, `/en/terms`). Without a
rewrite, refreshing `/en` returns Amplify's 404 page instead of the app. In the
Amplify console open **Hosting → Rewrites and redirects**, enable custom rules,
clear the default rule and paste `infra/amplify-rewrites.json`:

```json
[
  { "source": "/<*>", "target": "/index.html", "conditions": [] }
]
```

Save and redeploy. Until this is in place the root `/` still works and the
language switcher works in-app (client-side navigation), so the demo is not
blocked — only deep links and refreshes are affected.

## Legal pages

`/privacidad`, `/terminos`, `/cookies`, `/reembolsos` (and their English
counterparts) render from `src/content/legal.ts`, which holds the four policies
in both languages.

> These are **reference drafts written for this MVP, not legal advice.** They
> follow the structure Colombian law expects — Ley 1581 de 2012 on personal data
> protection, and the distance-sales withdrawal right in Decreto 1074 de 2015 —
> but they must be reviewed by a lawyer before being published as binding policy.
> The pages say so on screen.

## Contact form and Resend

The form posts to `POST /lead` on our own API. The Resend key lives in AWS
Secrets Manager (`atelier-predict/lead-resend`) and is fetched at runtime, so it
never appears in the Lambda configuration or the template.

```powershell
./infra/sync-resend-secret.ps1    # once, copies the key from the ColombiaTIC env
./infra/deploy.ps1
```

Lead notifications go to `enterprise@colombiatic.com.co` with the subject
`Nuevo lead desde Atelier Predict (hackathon) — <empresa>` and a body row
`Origen: atelier-predict-hackathon`, so hackathon leads are distinguishable from
the colombiatic.com.co landing. The submitter also receives a confirmation.

The pipeline mirrors the ColombiaTIC form: honeypot, 5 requests / 10 min per IP,
HTML escaping, per-field length caps, and a 201 fake-success for bots.

## Security debt

Deliberate shortcuts for a hackathon, each one named so it is not mistaken for
production posture:

- **No authentication.** `/chat` is publicly callable and each request costs real
  Bedrock tokens. Add API key or Cognito authorizer before exposing it.
- **CORS allows `*`.** Tighten `AllowOrigins` in `infra/template.yaml` to the
  Amplify URL.
- **Root AWS credentials** were used to deploy. A judge looking at the account
  sees the whole stack under root; move to an IAM user or role before demoing.
- **Log retention is 14 days** and no prompt caching is enabled — the system
  prompt is below Claude's minimum cacheable token count, so caching would never
  activate.

## License

Apache 2.0 — see `LICENSE`.