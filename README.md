# Marketing Agent AD BOT

AI-powered dashboard that analyzes Meta Ads + Google Ads campaign performance and surfaces recommendations via Claude.

## Structure

- `apps/api-server` — Express API (TypeScript), port 4000
- `apps/dashboard-web` — Next.js dashboard, port 3000
- `packages/shared-types` — shared TypeScript types
- `packages/prompt-library` — Claude prompt files
- `docs/` — product and architecture docs

## Quick start

```bash
npm install        # once, from repo root
npm run dev:api    # terminal 1 → http://localhost:4000
npm run dev:web    # terminal 2 → http://localhost:3000
```
