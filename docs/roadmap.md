# Roadmap

## Phase 1 — v1 dummy loop (current)

- [x] Monorepo scaffold (workspaces, shared-types)
- [x] API server: health + dummy analyze endpoint
- [x] Dashboard: sidebar layout + Chat Analyst page
- [x] Backend verified locally (Darius' Mac)
- [ ] Dashboard verified in browser (`npm run dev:web`)
- [ ] Code pushed to GitHub, Kaloyan pulls and runs it

## Phase 2 — Prompt library & Claude integration

- [x] `packages/prompt-library/master-claude-prompt.md`
- [x] `packages/prompt-library/api-prompt-template.md`
- [x] API calls Claude API, returns real AI recommendations
- [x] Anthropic API key via `.env` (never committed)

## Phase 3 — Scoring engine

- [x] `scoring.ts` with draft rules from [[data-schema]]
- [x] Unit tests for each rule (23 tests, `npm test`)
- [x] Deterministic `POST /api/analyze/score` endpoint (no Claude call)
- [x] Verdict bands tuned (zero-conversion split into warning/critical tiers)
- [x] Dashboard surfaces scores + verdict badges (Overview Health column + Alerts tab)

## Phase 3.5 — History + insight features (built on top of Phase 3)

- [x] SQLite snapshot history (`src/db/`), daily capture, `GET /api/history`, ~4 weeks seeded
- [x] CTR-drop rule activated from stored history
- [x] Trends page — per-campaign charts with metric toggle + CTR-falling flag
- [x] Alerts page — prioritized issues from scoring penalties
- [x] Conversational Chat Analyst (`POST /api/chat`) grounded in campaigns + scores
- [ ] Scheduled weekly digest (Claude summary → email/Slack)

## Phase 4 — Real data ingestion

- [x] Meta Ads API connection + normalizer (`src/ingestion/meta.ts`)
- [x] Google Ads API connection + normalizer (`src/ingestion/google.ts`)
- [x] Campaign list endpoint (`GET /api/campaigns`) + Overview page table
- [x] Live-or-mock fallback per platform with source badges in the UI
- [x] Meta: durable System User token (never-expiring) — Meta source is live
- [ ] Google: account activation (billing) + Basic access approval — applied 2026-06-15, awaiting Google (~3 business days)

## Phase 5 — Deployment & sharing

- [x] API → Railway, dashboard → Vercel (both live)
- [x] Env/secrets configured in platforms
- [ ] Basic auth or allowlist so only Darius & Kaloyan can access (currently open — fine for 2 people)
