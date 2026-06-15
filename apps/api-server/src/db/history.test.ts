import { test } from "node:test";
import assert from "node:assert/strict";
import { mockCampaigns } from "../mock-data.js";
import {
  addDays,
  latestSnapshotDate,
  selectPreviousCtrMap,
  generateSyntheticHistory,
} from "./history.js";

const END = "2026-06-15";
const DAYS = 28;

test("addDays handles normal and month-boundary math in UTC", () => {
  assert.equal(addDays("2026-06-15", -7), "2026-06-08");
  assert.equal(addDays("2026-06-01", -1), "2026-05-31");
  assert.equal(addDays("2026-06-15", 0), "2026-06-15");
});

test("generateSyntheticHistory makes one row per campaign per day", () => {
  const rows = generateSyntheticHistory(mockCampaigns, DAYS, END);
  assert.equal(rows.length, mockCampaigns.length * DAYS);
  // Each campaign has DAYS distinct dates, newest = END.
  for (const c of mockCampaigns) {
    const dates = rows.filter((r) => r.campaignId === c.campaignId).map((r) => r.snapshotDate);
    assert.equal(new Set(dates).size, DAYS);
    assert.ok(dates.includes(END));
    assert.equal([...dates].sort().at(-1), END);
  }
});

test("latestSnapshotDate returns the newest date", () => {
  const rows = generateSyntheticHistory(mockCampaigns, DAYS, END);
  assert.equal(latestSnapshotDate(rows), END);
  assert.equal(latestSnapshotDate([]), null);
});

test("zero-conversion campaigns stay at zero across history", () => {
  const rows = generateSyntheticHistory(mockCampaigns, DAYS, END);
  const g2 = rows.filter((r) => r.campaignId === "google-002");
  assert.ok(g2.every((r) => r.conversions === 0 && r.cpa === 0));
});

test("previous-CTR baseline makes the degrading campaign show a >25% drop", () => {
  const rows = generateSyntheticHistory(mockCampaigns, DAYS, END);
  const prev = selectPreviousCtrMap(rows, END, 7);

  // meta-001 is the seeded degrading campaign; today's CTR is 0.007.
  const today = mockCampaigns.find((c) => c.campaignId === "meta-001")!.ctr;
  assert.ok(prev["meta-001"] !== undefined);
  const drop = (prev["meta-001"] - today) / prev["meta-001"];
  assert.ok(drop > 0.25, `expected >25% drop, got ${(drop * 100).toFixed(1)}%`);
});

test("a stable campaign does NOT show a CTR drop", () => {
  const rows = generateSyntheticHistory(mockCampaigns, DAYS, END);
  const prev = selectPreviousCtrMap(rows, END, 7);
  const today = mockCampaigns.find((c) => c.campaignId === "meta-002")!.ctr; // 0.03
  const change = Math.abs(prev["meta-002"] - today) / today;
  assert.ok(change < 0.1, `expected stable CTR, drifted ${(change * 100).toFixed(1)}%`);
});

test("selectPreviousCtrMap picks the snapshot on/before the lag target", () => {
  const rows = generateSyntheticHistory(mockCampaigns, DAYS, END);
  // With lag 7 from END, the baseline date is 2026-06-08; its CTR should match.
  const target = addDays(END, -7);
  const prev = selectPreviousCtrMap(rows, END, 7);
  const directRow = rows.find(
    (r) => r.campaignId === "google-001" && r.snapshotDate === target
  )!;
  assert.equal(prev["google-001"], directRow.ctr);
});
