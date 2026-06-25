import { test } from "node:test";
import assert from "node:assert/strict";
import type { CampaignMetrics } from "@adbot/shared-types";
import {
  accountAverageCpa,
  scoreCampaign,
  scoreCampaigns,
  verdictFor,
  PENALTIES,
} from "./scoring.js";

// A healthy baseline campaign; tests tweak one field at a time.
function campaign(overrides: Partial<CampaignMetrics> = {}): CampaignMetrics {
  return {
    campaignId: "test-001",
    campaignName: "Test Campaign",
    platform: "meta",
    spend: 500,
    impressions: 100000,
    clicks: 3000,
    conversions: 50,
    ctr: 0.03,
    cpc: 0.17,
    cpa: 10,
    conversionValue: 2500,
    roas: 5,
    dateRangeStart: "2026-06-01",
    dateRangeEnd: "2026-06-07",
    ...overrides,
  };
}

const ctx = (avgCpa: number, zeroConvSpend = 50) => ({ avgCpa, zeroConvSpend });

test("verdict bands map score to verdict at the boundaries", () => {
  assert.equal(verdictFor(100), "healthy");
  assert.equal(verdictFor(70), "healthy");
  assert.equal(verdictFor(69), "warning");
  assert.equal(verdictFor(40), "warning");
  assert.equal(verdictFor(39), "critical");
  assert.equal(verdictFor(0), "critical");
});

test("account average CPA ignores campaigns with zero conversions", () => {
  const avg = accountAverageCpa([
    campaign({ campaignId: "a", cpa: 10, conversions: 5 }),
    campaign({ campaignId: "b", cpa: 30, conversions: 5 }),
    campaign({ campaignId: "c", cpa: 0, conversions: 0 }), // excluded
  ]);
  assert.equal(avg, 20); // (10 + 30) / 2, not / 3
});

test("a healthy campaign scores 100 and is healthy", () => {
  const r = scoreCampaign(campaign(), ctx(10));
  assert.equal(r.score, 100);
  assert.equal(r.verdict, "healthy");
  assert.equal(r.penalties.length, 0);
});

test("CTR below 1% applies the ctr-floor penalty", () => {
  const r = scoreCampaign(campaign({ ctr: 0.005 }), ctx(10));
  assert.equal(r.score, 100 - PENALTIES.ctrFloor);
  assert.ok(r.penalties.some((p) => p.rule === "ctr-floor"));
});

test("CTR drop > 25% vs previous period applies the ctr-drop penalty", () => {
  const r = scoreCampaign(campaign({ ctr: 0.02 }), ctx(10), { previousCtr: 0.04 });
  assert.ok(r.penalties.some((p) => p.rule === "ctr-drop"));
  assert.equal(r.score, 100 - PENALTIES.ctrDrop);
});

test("CTR drop rule is skipped when no previous CTR is provided", () => {
  const r = scoreCampaign(campaign({ ctr: 0.02 }), ctx(10));
  assert.ok(!r.penalties.some((p) => p.rule === "ctr-drop"));
});

test("CPA more than 2x account average applies the cpa-high penalty", () => {
  const r = scoreCampaign(campaign({ cpa: 25, conversions: 5 }), ctx(10));
  assert.ok(r.penalties.some((p) => p.rule === "cpa-high"));
  assert.equal(r.score, 100 - PENALTIES.cpaHigh);
});

test("CPA exactly at 2x is NOT penalized (strict greater-than)", () => {
  const r = scoreCampaign(campaign({ cpa: 20, conversions: 5 }), ctx(10));
  assert.ok(!r.penalties.some((p) => p.rule === "cpa-high"));
});

test("zero conversions above the spend threshold applies the zero-conv penalty", () => {
  const r = scoreCampaign(campaign({ conversions: 0, cpa: 0, spend: 200 }), ctx(10));
  assert.ok(r.penalties.some((p) => p.rule === "zero-conversions"));
});

test("zero conversions below the spend threshold is not penalized", () => {
  const r = scoreCampaign(campaign({ conversions: 0, cpa: 0, spend: 10 }), ctx(10));
  assert.ok(!r.penalties.some((p) => p.rule === "zero-conversions"));
});

test("a small zero-conversion spend is a warning, not critical", () => {
  const r = scoreCampaign(campaign({ conversions: 0, cpa: 0, spend: 120 }), ctx(10));
  assert.equal(r.score, 100 - PENALTIES.zeroConv); // 60
  assert.equal(r.verdict, "warning");
});

test("a large zero-conversion spend is severe and critical on its own", () => {
  const r = scoreCampaign(campaign({ conversions: 0, cpa: 0, spend: 980 }), ctx(10));
  const p = r.penalties.find((x) => x.rule === "zero-conversions");
  assert.equal(p?.penalty, PENALTIES.zeroConvSevere);
  assert.equal(r.score, 100 - PENALTIES.zeroConvSevere); // 35
  assert.equal(r.verdict, "critical");
});

test("low ROAS with revenue applies the roas-low penalty", () => {
  const r = scoreCampaign(
    campaign({ conversions: 10, conversionValue: 600, roas: 0.8, spend: 750, cpa: 8 }),
    ctx(10)
  );
  assert.ok(r.penalties.some((p) => p.rule === "roas-low"));
  assert.equal(r.score, 100 - PENALTIES.roasLow);
});

test("healthy ROAS is fine, and missing revenue data skips the ROAS rule", () => {
  const healthy = scoreCampaign(
    campaign({ conversions: 10, conversionValue: 2000, roas: 4, spend: 500, cpa: 8 }),
    ctx(10)
  );
  assert.ok(!healthy.penalties.some((p) => p.rule === "roas-low"));

  const noRevenue = scoreCampaign(
    campaign({ conversions: 10, conversionValue: 0, roas: 0, spend: 500, cpa: 8 }),
    ctx(10)
  );
  assert.ok(!noRevenue.penalties.some((p) => p.rule === "roas-low"));
});

test("a per-campaign target ROAS overrides the default", () => {
  // ROAS 3x passes the default 2x target, but fails a campaign goal of 5x.
  const r = scoreCampaign(
    campaign({ conversions: 10, conversionValue: 1500, roas: 3, spend: 500, cpa: 8 }),
    ctx(10),
    {},
    { targetRoas: 5 }
  );
  assert.ok(r.penalties.some((p) => p.rule === "roas-low"));
});

test("a per-campaign target CPA flags overspend the account average misses", () => {
  // CPA 15 is under 2x the account average (no cpa-high), but over a 12 target.
  const r = scoreCampaign(
    campaign({ conversions: 10, cpa: 15, spend: 150 }),
    ctx(10),
    {},
    { targetCpa: 12 }
  );
  assert.ok(r.penalties.some((p) => p.rule === "cpa-over-target"));
  assert.ok(!r.penalties.some((p) => p.rule === "cpa-high"));
});

test("Meta frequency above the cap applies the frequency penalty", () => {
  const r = scoreCampaign(campaign({ platform: "meta" }), ctx(10), { frequency: 5 });
  assert.ok(r.penalties.some((p) => p.rule === "frequency"));
});

test("frequency rule does not apply to Google campaigns", () => {
  const r = scoreCampaign(campaign({ platform: "google" }), ctx(10), { frequency: 9 });
  assert.ok(!r.penalties.some((p) => p.rule === "frequency"));
});

test("multiple failing rules stack and the score floors at 0", () => {
  // ctr-floor (20) + zero-conv (40, spend 300 < severe) + frequency (10) = 70 -> score 30
  const r = scoreCampaign(
    campaign({ ctr: 0.004, conversions: 0, cpa: 0, spend: 300, platform: "meta" }),
    ctx(10),
    { frequency: 6 }
  );
  assert.equal(r.score, 100 - (PENALTIES.ctrFloor + PENALTIES.zeroConv + PENALTIES.frequency));
  assert.equal(r.verdict, "critical");

  // Pile on a CTR drop too; total 90 -> score 10 -> critical, never negative.
  const worse = scoreCampaign(
    campaign({ ctr: 0.004, conversions: 0, cpa: 0, spend: 300, platform: "meta" }),
    ctx(10),
    { frequency: 6, previousCtr: 0.05 }
  );
  assert.equal(
    worse.score,
    100 - (PENALTIES.ctrFloor + PENALTIES.zeroConv + PENALTIES.frequency + PENALTIES.ctrDrop)
  );
  assert.equal(worse.verdict, "critical");
  assert.ok(worse.score >= 0);
});

test("scoreCampaigns derives the account average internally", () => {
  const results = scoreCampaigns([
    campaign({ campaignId: "lo", cpa: 10, conversions: 5 }),
    campaign({ campaignId: "hi", cpa: 50, conversions: 5 }), // 50 > 2 * avg(30)? avg=30, 2x=60 -> no
  ]);
  const hi = results.find((r) => r.campaignId === "hi")!;
  // avg of [10,50] = 30; 2x = 60; cpa 50 < 60 so no cpa penalty
  assert.ok(!hi.penalties.some((p) => p.rule === "cpa-high"));
  assert.equal(hi.score, 100);
});
