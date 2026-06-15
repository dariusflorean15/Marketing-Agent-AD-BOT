# Workflow — Darius & Kaloyan

## Git

- Repo: https://github.com/dariusflorean15/Marketing-Agent-AD-BOT (public)
- Branch model: `main` is always runnable. Feature work on short-lived branches (`feat/scoring-engine`), merged via PR so the other person can review.
- Commit style: short imperative messages, e.g. `add scoring engine rules`.

## Local development

```
npm install        (once, from repo root)
npm run dev:api    (terminal 1 → localhost:4000)
npm run dev:web    (terminal 2 → localhost:3000)
```

⚠️ Paste commands **without trailing comments** — zsh passes `#` along and npm errors (learned 2026-06-11, see [[decision-log]]).

## Verifying a change

1. `curl http://localhost:4000/api/health` → status ok
2. Dashboard → Chat Analyst → Run Analysis → cards render
3. Only then commit & push.

## This vault

- Lives in `docs/`, versioned with the code — docs PRs welcome.
- Update [[progress-journal]] after each working session.
- New decision? Add to [[decision-log]] with date + reasoning.

## Deployment (later)

- Push to `main` → Vercel auto-deploys dashboard, Railway auto-deploys API.
- Env vars set in platform dashboards, never committed.
