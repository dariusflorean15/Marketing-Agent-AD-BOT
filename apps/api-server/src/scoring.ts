import type { AnalysisResult, CampaignMetrics, Verdict } from "@adbot/shared-types";

// ── Tunable thresholds ────────────────────────────────────────────────
// These mirror docs/data-schema.md "Scoring rules (draft)". Tune here,
// record the reasoning in docs/decision-log.md.
export const THRESHOLDS = {
  ctrFloor: 0.01, // CTR below 1% is unhealthy
  ctrDropRatio: 0.25, // CTR fell >25% vs the previous period
  cpaMultiple: 2, // CPA more than 2x the account average
  zeroConvSpend: 50, // zero conversions while spending more than this
  frequencyCap: 4, // Meta frequency above this means ad fatigue
} as const;

export const PENALTIES = {
  ctrFloor: 20,
  ctrDrop: 20,
  cpaHigh: 25,
  zeroConv: 30,
  frequency: 10,
} as const;

// Verdict bands: >=70 healthy, 40-69 warning, <40 critical.
export function verdictFor(score: number): Verdict {
  if (score >= 70) return "healthy";
  if (score >= 40) return "warning";
  return "critical";
}

/** Optional per-campaign data not present in the normalized metrics. */
export interface ScoringExtras {
  previousCtr?: number; // CTR in the prior period, enables the trend rule
  frequency?: number; // Meta only; avg impressions per person
}

export interface ScoringOptions {
  /** Spend above which zero conversions is penalized. Defaults to THRESHOLDS.zeroConvSpend. */
  zeroConvSpend?: number;
}

export interface RulePenalty {
  rule: string;
  penalty: number;
  detail: string;
}

/** An AnalysisResult plus the transparent breakdown of why it scored that way. */
export interface CampaignScore extends AnalysisResult {
  penalties: RulePenalty[];
}

/**
 * Average CPA across campaigns that actually converted. Campaigns with zero
 * conversions (cpa = 0) are excluded so they don't drag the baseline to zero.
 */
export function accountAverageCpa(campaigns: CampaignMetrics[]): number {
  const converting = campaigns.filter((c) => c.conversions > 0 && c.cpa > 0);
  if (converting.length === 0) return 0;
  return converting.reduce((sum, c) => sum + c.cpa, 0) / converting.length;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function money(n: number): string {
  return n.toFixed(2);
}

interface ScoreContext {
  avgCpa: number;
  zeroConvSpend: number;
}

/** Scores a single campaign against the rule set. */
export function scoreCampaign(
  campaign: CampaignMetrics,
  ctx: ScoreContext,
  extras: ScoringExtras = {}
): CampaignScore {
  const penalties: RulePenalty[] = [];

  // Rule 1: low absolute CTR.
  if (campaign.impressions > 0 && campaign.ctr < THRESHOLDS.ctrFloor) {
    penalties.push({
      rule: "ctr-floor",
      penalty: PENALTIES.ctrFloor,
      detail: `CTR ${pct(campaign.ctr)} is below the ${pct(THRESHOLDS.ctrFloor)} floor; refresh creative or tighten targeting.`,
    });
  }

  // Rule 2: CTR dropped sharply vs the previous period (needs previousCtr).
  if (extras.previousCtr && extras.previousCtr > 0) {
    const drop = (extras.previousCtr - campaign.ctr) / extras.previousCtr;
    if (drop > THRESHOLDS.ctrDropRatio) {
      penalties.push({
        rule: "ctr-drop",
        penalty: PENALTIES.ctrDrop,
        detail: `CTR fell ${pct(drop)} vs the previous period; likely creative fatigue.`,
      });
    }
  }

  // Rule 3: CPA far above the account average (needs a meaningful baseline).
  if (ctx.avgCpa > 0 && campaign.cpa > 0 && campaign.cpa > THRESHOLDS.cpaMultiple * ctx.avgCpa) {
    const multiple = campaign.cpa / ctx.avgCpa;
    penalties.push({
      rule: "cpa-high",
      penalty: PENALTIES.cpaHigh,
      detail: `CPA ${money(campaign.cpa)} is ${multiple.toFixed(1)}x the account average (${money(ctx.avgCpa)}); pause or rework targeting.`,
    });
  }

  // Rule 4: spending with nothing to show for it.
  if (campaign.conversions === 0 && campaign.spend > ctx.zeroConvSpend) {
    penalties.push({
      rule: "zero-conversions",
      penalty: PENALTIES.zeroConv,
      detail: `Spent ${money(campaign.spend)} with zero conversions; check tracking and landing page, then pause if it persists.`,
    });
  }

  // Rule 5: Meta ad fatigue from over-exposure (needs frequency).
  if (campaign.platform === "meta" && extras.frequency !== undefined && extras.frequency > THRESHOLDS.frequencyCap) {
    penalties.push({
      rule: "frequency",
      penalty: PENALTIES.frequency,
      detail: `Frequency ${extras.frequency.toFixed(1)} exceeds ${THRESHOLDS.frequencyCap}; widen the audience to reduce fatigue.`,
    });
  }

  const totalPenalty = penalties.reduce((sum, p) => sum + p.penalty, 0);
  const score = Math.max(0, Math.min(100, 100 - totalPenalty));

  const recommendation =
    penalties.length === 0
      ? "Performing within healthy ranges — no action needed."
      : penalties.map((p) => p.detail).join(" ");

  return {
    campaignId: campaign.campaignId,
    campaignName: campaign.campaignName,
    platform: campaign.platform,
    score,
    verdict: verdictFor(score),
    recommendation,
    generatedAt: new Date().toISOString(),
    penalties,
  };
}

/**
 * Scores every campaign. Computes the account-average CPA once and reuses it,
 * so the CPA rule is relative to this account rather than an absolute number.
 * `extras` is keyed by campaignId for the optional previousCtr / frequency data.
 */
export function scoreCampaigns(
  campaigns: CampaignMetrics[],
  extras: Record<string, ScoringExtras> = {},
  options: ScoringOptions = {}
): CampaignScore[] {
  const ctx: ScoreContext = {
    avgCpa: accountAverageCpa(campaigns),
    zeroConvSpend: options.zeroConvSpend ?? THRESHOLDS.zeroConvSpend,
  };
  return campaigns.map((c) => scoreCampaign(c, ctx, extras[c.campaignId] ?? {}));
}
