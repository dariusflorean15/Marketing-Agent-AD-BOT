# API Architecture

## Monorepo layout

```
apps/api-server      Express + TypeScript (port 4000)
  src/ingestion/     Meta + Google pulls, live-or-mock fallback
  src/scoring.ts     Deterministic rule-based scoring + tests
  src/db/            SQLite snapshot history (better-sqlite3) + seed
  src/claude.ts      Claude analysis + conversational analyst
apps/dashboard-web   Next.js 15 App Router + Tailwind v4 (port 3000)
  pages: Overview / Alerts / Trends / Chat Analyst
packages/shared-types  Single source of truth for data contracts
packages/prompt-library  Claude prompt files
docs/                This vault
```

npm workspaces; install once from repo root.

## Data flow

```
Meta Ads API ─┐                                  ┌→ Claude → recommendations / chat
              ├→ ingestion → normalizer → metrics ┤→ scoring engine → score + verdict
Google Ads API┘                    │              └→ dashboard (Overview / Alerts / Trends)
                                   └→ daily snapshot → SQLite history → CTR-drop + trends
```

1. **Ingestion** fetches raw campaign stats per platform (live where credentials exist, mock otherwise).
2. **Normalizer** maps platform-specific fields into `CampaignMetrics` ([[data-schema]]).
3. **History** records one snapshot per campaign per day in SQLite; powers trends and the CTR-drop rule.
4. **Scoring engine** applies rules → score + verdict + penalties per campaign (deterministic, no Claude).
5. **Claude layer** provides full written analysis (`/api/analyze/run`) and a grounded chat (`/api/chat`).
6. **Dashboard** renders everything; both collaborators see the same state.

## Endpoints

| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/api/health` | ✅ live | Service heartbeat |
| GET | `/api/campaigns` | ✅ live | Normalized metrics (live-or-mock per platform); records a daily snapshot |
| GET | `/api/history` | ✅ live | Stored daily snapshots; optional `?campaignId` |
| POST | `/api/analyze/run` | ✅ live | Full analysis via Claude → `AnalyzeRunResponse` |
| POST | `/api/analyze/score` | ✅ live | Deterministic scores + penalty breakdown (no Claude) |
| POST | `/api/chat` | ✅ live | Conversational analyst grounded in campaigns + scores |

## Key decisions

See [[decision-log]]. Highlights: shared types package from day one; CORS open in dev so :3000 can call :4000; dummy-first development (wire the loop end-to-end before real data).

## Deployment (later)

- api-server → Railway
- dashboard-web → Vercel
- Secrets (ad platform tokens, Anthropic API key) via platform env vars, never in git.
