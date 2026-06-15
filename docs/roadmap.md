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
- [x] Unit tests for each rule (14 tests, `npm test`)
- [x] Deterministic `POST /api/analyze/score` endpoint (no Claude call)
- [ ] Verdict bands tuned on real-ish data (see decision-log: zero-conv lands at 70)
- [ ] Dashboard surfaces scores + verdict badges from `/api/analyze/score`

## Phase 4 — Real data ingestion

- [x] Meta Ads API connection + normalizer (`src/ingestion/meta.ts`)
- [x] Google Ads API connection + normalizer (`src/ingestion/google.ts`)
- [x] Campaign list endpoint (`GET /api/campaigns`) + Overview page table
- [x] Live-or-mock fallback per platform with source badges in the UI
- [ ] Meta: durable System User token (current token may be short-lived)
- [ ] Google: complete OAuth credentials + Basic access approval

## Phase 5 — Deployment & sharing

- [ ] API → Railway, dashboard → Vercel
- [ ] Env/secrets configured in platforms
- [ ] Basic auth or allowlist so only Darius & Kaloyan can access
