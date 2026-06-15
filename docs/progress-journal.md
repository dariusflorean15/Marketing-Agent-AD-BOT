# Progress Journal

Newest first. One entry per working session.

## 2026-06-15 — Phase 3 scoring, history database, and dashboard build-out

**Built:**
- **Scoring engine** (`src/scoring.ts`): deterministic rules from [[data-schema]] (CTR floor, CTR-drop vs previous period, CPA > 2× account avg, tiered zero-conversions, Meta frequency); verdict bands; exported `THRESHOLDS`/`PENALTIES`. 23 unit tests via `npm test`. New deterministic `POST /api/analyze/score` (no Claude call, no cost).
- **Snapshot history database** (SQLite via `better-sqlite3`, `src/db/`): one row per campaign per day, auto-captured on `GET /api/campaigns`; `GET /api/history`; pure helpers (`generateSyntheticHistory`, `selectPreviousCtrMap`) with their own tests. Seeded ~4 weeks of sample history (`npm run seed`). This activated the previously-dormant CTR-drop rule.
- **Conversational Chat Analyst** (`POST /api/chat` → `askAnalyst`): Claude answers questions grounded in current campaigns + computed scores. Page rebuilt as a chat (bubbles, suggestion chips, typing indicator).
- **Dashboard pages:** Trends (per-campaign SVG charts, metric toggle, CTR-falling flag), Overview upgraded (summary cards + Health column + CTR↓ flag), Alerts (prioritized issues from scoring penalties). Sidebar: Overview / Alerts / Trends / Chat Analyst.
- **Tuned** the zero-conversion rule into warning (spend > $50) / critical (spend > $500) tiers (see [[decision-log]]).

**Verified:** all 23 tests pass; live Claude chat gave accurate, grounded answers citing real numbers; Generic Search correctly flips to critical after tuning.

**Credentials:** all `.env` keys are in and authenticating, but both ad accounts still need activation (Meta "get set up to run ads"; Google `CUSTOMER_NOT_ENABLED`) before live data flows — code falls back to mock per platform meanwhile.

**Next:** deploy (Phase 5, Railway + Vercel) so Kaloyan can use it; scheduled weekly digest; activate ad-account billing.

## 2026-06-12 — Claude live + real data ingestion

**Built:**
- Claude integration verified end-to-end: Run Analysis returns real AI recommendations (after fixing an invalid API key by regenerating it)
- Ingestion layer: `src/ingestion/meta.ts` (Graph API, last 7 days), `src/ingestion/google.ts` (google-ads-api, GAQL), orchestrator with live-or-mock fallback per platform
- `GET /api/campaigns` endpoint
- Overview page: real campaign table (spend, CTR, CPC, conversions, CPA) + live/mock/error source badges
- Merged old GitHub repo history into the project folder; kept `.env.example`, team guide, master prompt

**Notes:**
- Meta credentials in `.env`; Google credentials in progress (needs full OAuth set + Basic access)
- Claude analyzes whatever ingestion returns: real campaigns where live, mocks elsewhere

**Next:** verify live Meta data in Overview, finish Google OAuth, commit + push, then scoring engine (Phase 3).

## 2026-06-11 — v1 scaffold built and running locally

**Built:**
- Monorepo root (npm workspaces) + `.gitignore` + README
- `packages/shared-types` — `CampaignMetrics`, `AnalysisResult`, `AnalyzeRunResponse`
- `apps/api-server` — Express + TS on :4000 with `GET /api/health` and dummy `POST /api/analyze/run` (2 fake recommendations)
- `apps/dashboard-web` — Next.js 15 + Tailwind v4: `/dashboard` sidebar layout, Overview page, Chat Analyst page with Run Analysis button calling the API
- This docs vault

**Verified:**
- Backend installed and ran in Claude's sandbox; both endpoints returned correct JSON
- On Darius' Mac (Node v20.20.0): `npm install` + `npm run dev:api` working, health endpoint confirmed in browser ("Cannot GET /" at root is expected — no root route)

**Hiccups:**
- Pasted inline `#` comments broke npm install → fixed by re-running clean commands
- Repo was private; now public

**Next up:** see [[roadmap]] — dashboard verification in browser, push to GitHub, then prompt library (Step 4).
