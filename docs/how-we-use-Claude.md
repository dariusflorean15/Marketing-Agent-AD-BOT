# How We Use Claude - Team Operating Guide

This document explains how Darius and his collaborator use Claude + GitHub together to build the Marketing Agent AD BOT.

## The Setup

- **GitHub repo** = source of truth for all code and docs
- **Claude (individual chats)** = AI coding and analysis assistant
- **Shared prompt** = master prompt in `packages/prompt-library/master-claude-prompt.md`

## Daily Workflow

### Before starting any Claude session

1. Pull latest changes from GitHub:
   ```bash
   git pull origin main
   ```
2. Open Claude in your browser (claude.ai)
3. Start a new chat
4. Copy the full content of `packages/prompt-library/master-claude-prompt.md`
5. Paste it as your FIRST message in the Claude chat
6. Then tell Claude what you are working on today

### During the session

- Ask Claude to generate code, explain concepts, or review logic
- When Claude gives you code, paste it into the correct file in the repo
- Test it locally before committing
- Commit and push when a feature or fix is working

### After the session

- Ask Claude: "Summarize what we did in this session in 5 bullets for our change log"
- Paste that summary into `docs/decision-log.md` under today's date
- Push the update so your collaborator can see what changed

## Branch Strategy

- `main` = stable, working code only
- `feature/your-feature-name` = your work branch
- Never push broken code directly to main
- Open a pull request when your feature is ready

## Who Owns What

| Area | Owner |
|---|---|
| API server, Claude integration, scoring engine | Darius |
| Dashboard UI, recommendation table, charts | Friend |
| Prompt updates | Both (agree before changing) |
| Docs and decision log | Both (update after each session) |

## Prompt Rules

- Only ONE master prompt lives in `packages/prompt-library/master-claude-prompt.md`
- If you want to change the prompt, discuss it first, then update the file and commit
- Both team members always use the SAME prompt so Claude outputs are consistent
- Never use a personal modified prompt without updating the shared file

## When You Improve Something

1. Update the code or prompt
2. Test it
3. Commit and push
4. Add a note to `docs/decision-log.md` explaining what changed and why
5. Message your collaborator so they know to pull

## Example Claude Session Start

```
[Paste master prompt here]

Today I am working on: [feature name]
Current file I need to edit: [file path]
What I need help with: [description]
```

That's it. Keep it simple, keep it consistent.
