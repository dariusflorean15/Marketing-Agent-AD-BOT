# Data Schema Reference

Source of truth: `packages/shared-types/src/index.ts`. This note explains it; if they diverge, the code wins.

## CampaignMetrics (normalized)

Same shape for every platform.

| Field | Type | Notes |
|---|---|---|
| campaignId | string | platform-prefixed, e.g. `meta-001` |
| campaignName | string | |
| platform | `"meta"` \| `"google"` | |
| spend | number | account currency |
| impressions | number | |
| clicks | number | |
| conversions | number | |
| ctr | number | clicks / impressions |
| cpc | number | spend / clicks |
| cpa | number | spend / conversions |
| dateRangeStart/End | string | ISO dates |

### Platform mapping (planned)

| Normalized | Meta Ads | Google Ads |
|---|---|---|
| spend | `spend` | `metrics.cost_micros / 1e6` |
| conversions | `actions[purchase]` | `metrics.conversions` |
| ctr | `ctr` | `metrics.ctr` |

## AnalysisResult

| Field | Type | Notes |
|---|---|---|
| score | number | 0–100, higher = healthier |
| verdict | `healthy` \| `warning` \| `critical` | |
| recommendation | string | plain-language, actionable |
| generatedAt | string | ISO datetime |

`AnalyzeRunResponse = { results: AnalysisResult[] }` — returned by `POST /api/analyze/run`.

## Scoring rules (draft, not yet implemented)

Start at 100, subtract penalties:

| Rule | Penalty |
|---|---|
| CTR < 1% | −20 |
| CTR dropped > 25% vs previous period | −20 |
| CPA > 2× account average | −25 |
| Zero conversions with spend > threshold | −30 |
| Frequency > 4 (Meta) | −10 |

Verdict bands: **≥ 70 healthy · 40–69 warning · < 40 critical**

These rules live in the API server (planned `apps/api-server/src/scoring.ts`) and are tuned in [[decision-log]] entries as we learn.
