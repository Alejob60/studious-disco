# Atelier Predict

MVP frontend for the **AWS Zero to Shipped 2026** hackathon — an agentic demand
forecasting dashboard for Colombian retail.

> **Note:** every number on the page is mocked. There is no backend yet; the
> dataset lives in `src/data/mock.ts` so wiring a real API later is a one-file
> change.

## Stack

| Concern    | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | React 19 + TypeScript, built with Vite 8           |
| Styling    | Tailwind CSS v4 (CSS-first `@theme` tokens)        |
| Charts     | Recharts 3                                         |
| Animation  | Motion 13 (`motion/react`)                         |
| Icons      | lucide-react                                       |
| Hosting    | AWS Amplify Hosting (static build output)           |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

```bash
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
npm run lint       # oxlint
```

**Windows caveat:** if `npm run lint` fails with
`Cannot find module './oxlint.win32-x64-msvc.node'`, your machine's Application
Control / WDAC policy is blocking the native binary. This is environmental —
lint works on Linux/macOS and in CI.

## Design system

Tokens are declared once in `src/index.css` under `@theme` and become Tailwind
utilities automatically (`bg-surface`, `text-gold`, `border-line`, …).

| Token        | Value                     | Role                    |
| ------------ | ------------------------- | ----------------------- |
| `ink`        | `#050505`                 | page background         |
| `surface`    | `#161616`                 | cards and panels        |
| `surface-2`  | `#1e1e1e`                 | nested/elevated surfaces|
| `body`       | `#A1A1AA`                 | secondary text          |
| `gold`       | `#D4AF37`                 | primary accent          |
| `gold-light` | `#F3E5AB`                 | accent gradient end     |
| `aws`        | `#2ECC71` on `#052E1B`    | "Powered by AWS" badge  |
| `line`       | `rgba(255,255,255,0.08)`  | hairline borders        |

## Project structure

```
src/
  components/
    Header.tsx           sticky nav + AWS badge, gold hairline on scroll
    Hero.tsx             headline, CTA, trust points
    KpiCards.tsx         3 headline metrics with count-up animation
    ForecastChart.tsx    real vs. predicted area chart (lazy loaded)
    AgentChat.tsx        agent conversation UI with simulated replies
    Footer.tsx           hackathon attribution
    ui/
      Reveal.tsx         scroll-triggered entrance wrapper
      ChartSkeleton.tsx  placeholder while Recharts loads
  data/mock.ts           all demo data in one file
  lib/
    format.ts            es-CO number formatting
    useCountUp.ts        in-view number animation
  App.tsx                section composition
```

## Accessibility & responsiveness

- Honours `prefers-reduced-motion` — every animation degrades to a static render.
- Keyboard-reachable chart legend, "skip to content" link, labelled inputs.
- Single-column on mobile, three-column KPI grid from `lg`.

## Deploy to AWS Amplify Hosting

The app is a static SPA, so no build spec file is required — Amplify detects
Vite automatically.

1. Push this repo to GitHub.
2. In the AWS console open **Amplify → Create new app → Host your web app**.
3. Choose **GitHub**, authorise the connection, and select this repository and
   the `main` branch.
4. Amplify fills in the build settings:

   ```
   Base directory:        /            (leave empty)
   Build command:         npm run build
   Output directory:      dist
   Runtime:               Node.js 22
   ```

5. **Save and deploy**. When the build goes green you get a URL shaped like
   `https://main.<random>.amplifyapp.com`.

No environment variables are required for the MVP.

### CLI alternative

```bash
aws amplify create-app --name atelier-predict --platform WEB_COMPUTE
aws amplify add hosting --generate
git remote add amplify https://<app-id>.amplifyapp.com
git push -u amplify main
```

Prefer the console for a hackathon — it is fewer steps and no local Amplify CLI
install.

## License

See `LICENSE`.