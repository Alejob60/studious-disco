# AGENTS.md

Orientation for whoever — human or AI agent — opens this repository cold.
Written after the traps below each cost real time, so read this before changing
anything that touches deployment or routing.

## What this is

Retail demand forecasting, built for the AWS Zero to Shipped hackathon. A
statistical forecast (Holt-Winters) scored against a naive baseline, a Claude
agent on Bedrock that turns that forecast into actions, and a demo page that lets
a visitor score their own CSV with the same engine and keeps the record.

- **Live site:** https://main.d28ukybtuih8pa.amplifyapp.com
- **API index (self-describing):** `https://il67zr1fr5.execute-api.us-east-1.amazonaws.com/`
- **Repository:** https://github.com/Alejob60/studious-disco
- **Region:** `us-east-1` · **Account:** `409514059726`

## Getting real customer data

`docs/CONTRATO-DATOS.md` is the contract to send a customer, and
`docs/CORREO-SOLICITUD-DATOS.md` is the email to send with it. Both are
**generated** from `docs/data-contract.examples.json` by
`scripts/generate-data-contract.mjs` on every build.

That indirection is the point. Every example in the contract is asserted against
the real parser by `backend/test/data-contract.test.js`, so the document cannot
describe a format the code does not accept — the suite fails first. A contract
that overpromises is worse than none: a store manager who exports in a format we
reject concludes the product does not understand their business.

Edit the JSON, never the markdown.

Two things to raise in every conversation with a customer:

- **Semicolon, not comma.** Spanish-locale Excel is the most common cause of a
  rejected file. It is already called out on the blank template.
- **Ask for the stock flag.** A zero on a day the shelf was empty is not zero
  demand. Today the diagnostics can *report* such days; with a stock column they
  could be excluded before fitting, which is the difference between a flagged
  number and an honest one.

## Verify before you claim anything

```bash
npm ci
npm run verify            # typecheck + 118 unit tests
npm run verify:api        https://il67zr1fr5.execute-api.us-east-1.amazonaws.com
npm run verify:integration https://main.d28ukybtuih8pa.amplifyapp.com https://il67zr1fr5.execute-api.us-east-1.amazonaws.com
```

`verify:integration` runs against production, not a local build. **202 checks
total.** It is the thing that catches drift between what the repository claims
and what is actually deployed, so treat a red run as a real finding rather than
noise.

Both scripts require their URLs as arguments. Running them bare prints usage and
exits — that is not a failure.

## Architecture, briefly

| Piece | Where |
|---|---|
| Static SPA | Amplify Hosting, built from `main` on push |
| API | API Gateway HTTP API → 5 Lambdas |
| Storage | MongoDB Atlas, database `atelier_predict` (existing cluster, reused) |
| Challenger model | TimesFM 2.5 on App Runner, fed by a nightly EventBridge job |
| IaC | `infra/template.yaml` (app) + `infra/template-timesfm.yaml` (challenger) |

Lambdas: `forecast` (hot path, no SDK), `agent` (Bedrock), `lead` (Resend),
`evaluate` (MongoDB), `batch` (nightly orchestrator).

One bundle per function, produced by `scripts/bundle-functions.mjs`. This is
deliberate: a shared zip made the forecast function download 2.4 MB to run 18 KB
of code, on the path that runs on every page load.

## Traps

Each of these has already bitten. They are not hypothetical.

**Amplify's SPA rewrite does not work in this account.** The custom rule
`/*` → `/index.html` is saved on the app and is silently ignored; requests are
answered from S3 through CloudFront as `NoSuchKey`. `/es` only ever worked because
the build emits a real `index.html` at every route. **Never rely on the rewrite.**
The route list lives in `scripts/routes.mjs`, parsed from the TypeScript the
router reads, so `generate-seo.mjs` and `emit-locale-entries.mjs` cannot drift.

**`infra/deploy.ps1` silently disables the challenger if you forget a flag.**
`-ForecastBucketName` defaults to `''`, and the script passes every parameter
explicitly by design. Running it bare turns the TimesFM path off and `/forecast`
quietly falls back to Holt-Winters. Always pass it.

**The RDS instance is unreachable from the Lambdas.** `realculture-postgres` is
private and in a VPC; the functions are not. Attaching them would remove their
internet access, which breaks Secrets Manager, Resend and Bedrock, and fixing
that needs a NAT gateway. Persistence therefore uses MongoDB Atlas over its
public endpoint. Do not "improve" this by moving to RDS without reading this.

**Atlas reachability from Lambda was verified, not assumed.** The cluster's IP
access list is per-cluster and had never been reached from a function outside a
VPC. A throwaway probe Lambda established it before any code depended on it. If
you change the network path, probe again — the console cannot tell you.

**CORS tests must send an `Origin` header.** Node's `fetch` omits it by
otherwise, so the suite used to be unable to distinguish working CORS from broken
CORS. Two checks now assert a foreign origin is refused. `/chat` and `/lead` are
deliberately public during the hackathon; the wildcard origin is not.

**The sample CSV is anchored to its build date.** The values are seeded and
reproducible, but the weekday alignment shifts, so the same file has measured
10.40 % and 8.88 % WAPE across two builds. Do not describe it as a fixed
benchmark, and do not read the ledger's spread as a trend.

**Never print a secret value.** Secrets Manager values are read at runtime and
cached in the module scope. When inspecting, print the length, not the value.

## Deploying

```bash
# Backend (add -ForecastBucketName or you turn the challenger off)
./infra/deploy.ps1 -ForecastBucketName atelier-predict-timesfm-forecastbucket-ff12rtt64dgu

# Frontend: push to main. Amplify builds automatically; a failed build keeps the
# previous deployment live, so a broken commit does not take the site down.
git push origin main
```

Both are independently reversible. Check the stack reached `UPDATE_COMPLETE` and
then run `verify:integration`.

## Where things stand

Shipped: bilingual SPA with browser-language detection at the root, deep links as
real files, CORS restricted, the real-data lab, the ledger read back from MongoDB,
and the nightly TimesFM challenger.

The honest gap: **all data is synthetic.** A judge can ask for a real customer and
there is not one. That is the highest-value thing left.

Other open items, in order:

1. Real CSV from a Colombian retailer
2. An action log for the agent — `activate_campaign` validates and clamps but
   leaves no record
3. Multi-tenancy on the existing collection
4. Replace the root credentials used for deployment (TASK-4.3). The CLI identity
   is still `arn:aws:iam::409514059726:root`

## Cost

App Runner bills for the time a service exists and cannot scale to zero:
**~$120–180/month**, the only standing cost. Everything else scales to zero.

**App Runner is in maintenance mode.** AWS stopped accepting new customers on
2026-04-30 and will add no features. Existing customers keep working and can still
create services — including us, and our service was created after that date — but
there is no announced sunset. It is safe for the hackathon and a liability for the
commercial phase, where ECS Express Mode is AWS's own recommendation.
