# Decision Log

Newest first. Format: date — decision — why.

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
