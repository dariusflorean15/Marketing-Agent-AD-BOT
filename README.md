# Marketing Agent AD BOT

AI-powered marketing optimization dashboard for Google Ads and Meta Ads.

## What it does

- Pulls campaign performance data from Google Ads and Meta Ads
- Scores campaigns using a rule-based engine (CTR, CPC, CPA, ROAS, frequency)
- Detects underperforming ads and flags likely causes
- Uses Claude AI to generate plain-English diagnosis and recommendations
- Shows results in a shared dashboard for two collaborators
- Includes a Chat Analyst panel for asking questions about campaigns

## Folder structure

```
Marketing-Agent-AD-BOT/
  apps/
    api-server/       Node.js + Express backend (TypeScript)
    dashboard-web/    Next.js frontend (App Router, Tailwind)
  packages/
    prompt-library/   Master Claude prompts and API prompt templates
    shared-types/     Shared TypeScript types
  docs/
    product-spec.md
    api-architecture.md
    prompt-system.md
    workflow.md
    how-we-use-Claude.md
  .env.example
  .gitignore
  README.md
```

## Tech stack

- Frontend: Next.js (App Router, TypeScript, Tailwind CSS)
- Backend: Node.js + Express (TypeScript)
- Database: PostgreSQL + Prisma (coming in v2)
- AI layer: Claude API (Anthropic)
- Version control: GitHub
- Deployment: Railway / Vercel

## Team

- Darius - Architecture, backend, Claude integration, prompt system
- Friend - Dashboard UI, recommendation review, campaign operations

## How we collaborate

See `docs/how-we-use-Claude.md` for the full collaboration workflow.

Both team members:
1. Clone this repo and work on separate branches
2. Use the master prompt from `packages/prompt-library/master-claude-prompt.md` at the start of every Claude session
3. Commit and push changes, then open pull requests for review
4. Keep docs updated when rules or prompts change

## Getting started

### Backend

```bash
cd apps/api-server
npm install
npm run dev
```

Health check: `http://localhost:4000/api/health`

### Frontend

```bash
cd apps/dashboard-web
npm install
npm run dev
```

Dashboard: `http://localhost:3000/dashboard`

## Environment variables

Copy `.env.example` to `.env` and fill in your keys. Never commit `.env` to GitHub.
