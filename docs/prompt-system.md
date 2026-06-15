# Prompt System

How the Claude analysis layer works.

## Principle

Claude never sees raw platform exports. It receives **normalized, pre-scored data** ([[data-schema]]) and is asked for interpretation + recommendations only. The rule engine decides *what is weak*; Claude explains *why and what to do*.

## Prompt files

Located in `packages/prompt-library/`:

| File | Purpose | Status |
|---|---|---|
| `master-claude-prompt.md` | System prompt: role, tone, output JSON schema | planned (Step 4) |
| `api-prompt-template.md` | Per-request template the API fills with metrics | planned (Step 4) |

## Request flow

```
POST /api/analyze/run
  → load normalized metrics
  → run scoring engine
  → fill api-prompt-template with metrics + scores
  → call Claude API (model: claude-sonnet, JSON output)
  → validate response against AnalysisResult[]
  → return AnalyzeRunResponse to dashboard
```

## Output contract

Claude must return JSON parseable as `AnalysisResult[]` — same type the dummy endpoint returns today, so swapping dummy → real Claude requires **zero dashboard changes**.

## Guardrails (planned)

- Temperature low (consistency over creativity)
- Validate/clamp scores to 0–100
- If Claude output fails JSON parse → retry once, then return rule-engine verdicts with a generic recommendation
