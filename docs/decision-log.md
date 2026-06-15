# Decision Log

Newest first. Format: date — decision — why.

## 2026-06-15 — Phase 3 scoring engine is deterministic and rule-based
`src/scoring.ts` implements the draft penalties from [[data-schema]] (start at 100, subtract). It runs with no Claude call via `POST /api/analyze/score`, so scores are free, instant, and reproducible — Claude stays for the plain-language narrative in `/api/analyze/run`. Thresholds live in exported `THRESHOLDS`/`PENALTIES` constants for easy tuning. 14 unit tests cover every rule and the band boundaries (`npm test`).

## 2026-06-15 — CTR-drop and frequency rules are optional
Normalized `CampaignMetrics` has no previous-period CTR or Meta frequency, so those two rules only fire when that data is passed via the `extras` arg; otherwise they're skipped rather than faked. Account-average CPA is computed only over campaigns that actually converted, so zero-conversion campaigns don't drag the baseline to 0.

## 2026-06-15 — TO TUNE: zero-conversion penalty lands on the healthy boundary
A campaign with spend but zero conversions loses 30, scoring exactly 70 = "healthy". On real data that reads too generous (e.g. $980 spent, 0 conv shows green). Candidate fixes: raise the zero-conv penalty to ~35-40, or lower the healthy band to >70. Decide once we see live numbers.

## 2026-06-11 — docs/ doubles as Obsidian vault
Shared knowledge base versioned with the code; Kaloyan gets it via `git pull`, no separate sync tool.

## 2026-06-11 — npm workspaces monorepo
One `npm install`, one repo, shared types resolve locally. Simpler than separate repos or pnpm/turbo for a 2-person project.

## 2026-06-11 — `packages/shared-types` from day one
API and dashboard import the same `CampaignMetrics` / `AnalysisResult` interfaces, so the contract can't silently drift. Ships raw `.ts` (no build step); Next.js handles it via `transpilePackages`.

## 2026-06-11 — Dummy-first development
`POST /api/analyze/run` returns hardcoded fake recommendations before any real ingestion/scoring/Claude exists. Proves the full loop (API → dashboard render) early; each fake part gets replaced without touching the others.

## 2026-06-11 — Express 4 + tsx (not Express 5 / ts-node)
Boring, stable, huge ecosystem. `tsx watch` gives instant TS reload with zero config.

## 2026-06-11 — Next.js 15 App Router + Tailwind v4
Standard modern stack; Tailwind v4 needs only a one-line CSS import and a PostCSS plugin, no config file.

## 2026-06-11 — CORS wide open in dev
Dashboard (:3000) must call API (:4000) cross-origin locally. Lock down before deployment.

## 2026-06-11 — Commands shared without inline comments
Darius' zsh passed `# comment` into npm → `EINVALIDTAGNAME` error. All shell snippets are now comment-free.
