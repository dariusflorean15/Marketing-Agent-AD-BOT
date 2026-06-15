# API Architecture

## Monorepo layout

```
apps/api-server      Express + TypeScript (port 4000)
apps/dashboard-web   Next.js 15 App Router + Tailwind v4 (port 3000)
packages/shared-types  Single source of truth for data contracts
packages/prompt-library  Claude prompt files
docs/                This vault
```

npm workspaces; install once from repo root.

## Data flow (target)

```
Meta Ads API ─┐
              ├→ ingestion → normalizer → scoring engine → Claude → recommendations → dashboard
Google Ads API┘
```

1. **Ingestion** fetches raw campaign stats per platform.
2. **Normalizer** maps platform-specific fields into `CampaignMetrics` ([[data-schema]]).
3. **Scoring engine** applies rules → score + verdict per campaign.
4. **Claude layer** receives normalized metrics + scores, returns structured `AnalysisResult` recommendations ([[prompt-system]]).
5. **Dashboard** renders results; both collaborators see the same state.

## Endpoints

| Method | Path | Status | Description |
|---|---|---|---|
| GET | `/api/health` | ✅ live | Service heartbeat |
| POST | `/api/analyze/run` | ✅ dummy | Runs full analysis, returns `AnalyzeRunResponse`. Currently returns hardcoded fake results. |
| GET | `/api/campaigns` | planned | Normalized metrics for all campaigns |
| POST | `/api/ingest/meta` | planned | Trigger Meta data pull |
| POST | `/api/ingest/google` | planned | Trigger Google data pull |

## Key decisions

See [[decision-log]]. Highlights: shared types package from day one; CORS open in dev so :3000 can call :4000; dummy-first development (wire the loop end-to-end before real data).

## Deployment (later)

- api-server → Railway
- dashboard-web → Vercel
- Secrets (ad platform tokens, Anthropic API key) via platform env vars, never in git.
