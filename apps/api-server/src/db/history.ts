import type { CampaignMetrics, CampaignSnapshot } from "@adbot/shared-types";

// Pure helpers for working with snapshot history. No database here, so these
// are fully unit-testable on their own.

/** Adds (or subtracts) whole days to a YYYY-MM-DD string, staying in UTC. */
export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** The most recent snapshot date present, or null if there are none. */
export function latestSnapshotDate(snapshots: CampaignSnapshot[]): string | null {
  let max: string | null = null;
  for (const s of snapshots) {
    if (max === null || s.snapshotDate > max) max = s.snapshotDate;
  }
  return max;
}

/**
 * For each campaign, the CTR from roughly `lagDays` ago — the baseline the
 * CTR-drop rule compares today's CTR against. Picks the most recent snapshot
 * on or before (latestDate - lagDays). YYYY-MM-DD sorts correctly as strings.
 */
export function selectPreviousCtrMap(
  snapshots: CampaignSnapshot[],
  latestDate: string,
  lagDays = 7
): Record<string, number> {
  const target = addDays(latestDate, -lagDays);
  const best: Record<string, { date: string; ctr: number }> = {};
  for (const s of snapshots) {
    if (s.snapshotDate > target) continue;
    const cur = best[s.campaignId];
    if (!cur || s.snapshotDate > cur.date) {
      best[s.campaignId] = { date: s.snapshotDate, ctr: s.ctr };
    }
  }
  const out: Record<string, number> = {};
  for (const id of Object.keys(best)) out[id] = best[id].ctr;
  return out;
}

/** Deterministic pseudo-noise in [-1, 1) from a string key (FNV-1a based). */
function noise(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h % 1000) / 500 - 1;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Campaigns whose CTR was higher in the past and has declined — used to make
// the CTR-drop rule visibly fire on sample data.
const DEGRADING = new Set(["meta-001"]);

/**
 * Builds `days` days of realistic synthetic snapshots ending at `endDate`,
 * one row per campaign per day. Deterministic (no Math.random) so tests are
 * stable. Each day is treated like that day's trailing pull, so magnitudes
 * stay close to the campaign's current numbers, with mild daily noise.
 */
export function generateSyntheticHistory(
  campaigns: CampaignMetrics[],
  days: number,
  endDate: string
): CampaignSnapshot[] {
  const rows: CampaignSnapshot[] = [];

  for (const c of campaigns) {
    for (let d = 0; d < days; d++) {
      const date = addDays(endDate, -d);
      const ageFrac = days > 1 ? d / (days - 1) : 0; // 0 = most recent, 1 = oldest
      const dayMult = 1 + 0.12 * noise(`${c.campaignId}|${date}`); // +/-12%

      // Degrading campaigns had a higher CTR in the past, so today reads as a
      // clear week-over-week decline (steep enough to trip the CTR-drop rule).
      const ctrBase = DEGRADING.has(c.campaignId)
        ? c.ctr * (1 + 1.6 * ageFrac)
        : c.ctr;

      const impressions = Math.max(1, Math.round(c.impressions * dayMult));
      const clicks = Math.max(0, Math.round(impressions * ctrBase));
      const spend = Math.max(0, round2(c.spend * dayMult));
      const conversions =
        c.conversions > 0 ? Math.max(0, Math.round(c.conversions * dayMult)) : 0;

      const ctr = impressions > 0 ? clicks / impressions : 0;
      const cpc = clicks > 0 ? round2(spend / clicks) : 0;
      const cpa = conversions > 0 ? round2(spend / conversions) : 0;

      rows.push({
        snapshotDate: date,
        campaignId: c.campaignId,
        campaignName: c.campaignName,
        platform: c.platform,
        spend,
        impressions,
        clicks,
        conversions,
        ctr,
        cpc,
        cpa,
        source: "mock",
      });
    }
  }

  return rows;
}
