import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type {
  CampaignMetrics,
  CampaignsResponse,
  CampaignSnapshot,
  DataSource,
  Platform,
} from "@adbot/shared-types";
import { latestSnapshotDate, selectPreviousCtrMap } from "./history.js";

// One SQLite file under apps/api-server/data/. Override with ADBOT_DB_PATH.
const DB_PATH =
  process.env.ADBOT_DB_PATH || path.resolve(process.cwd(), "data/adbot.db");

let db: Database.Database | null = null;

/** Opens the database (creating the file + table on first use) and caches it. */
export function getDb(): Database.Database {
  if (db) return db;
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      snapshot_date TEXT    NOT NULL,
      campaign_id   TEXT    NOT NULL,
      campaign_name TEXT    NOT NULL,
      platform      TEXT    NOT NULL,
      spend         REAL    NOT NULL,
      impressions   INTEGER NOT NULL,
      clicks        INTEGER NOT NULL,
      conversions   INTEGER NOT NULL,
      ctr           REAL    NOT NULL,
      cpc           REAL    NOT NULL,
      cpa           REAL    NOT NULL,
      source        TEXT    NOT NULL,
      PRIMARY KEY (snapshot_date, campaign_id)
    );
  `);
  return db;
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

// Shared upsert: one row per (date, campaign). Re-running the same day updates
// it in place instead of duplicating, which is what makes daily capture safe.
function upsertStatement(d: Database.Database) {
  return d.prepare(`
    INSERT INTO snapshots
      (snapshot_date, campaign_id, campaign_name, platform, spend, impressions,
       clicks, conversions, ctr, cpc, cpa, source)
    VALUES
      (@snapshot_date, @campaign_id, @campaign_name, @platform, @spend, @impressions,
       @clicks, @conversions, @ctr, @cpc, @cpa, @source)
    ON CONFLICT(snapshot_date, campaign_id) DO UPDATE SET
      campaign_name = excluded.campaign_name,
      platform      = excluded.platform,
      spend         = excluded.spend,
      impressions   = excluded.impressions,
      clicks        = excluded.clicks,
      conversions   = excluded.conversions,
      ctr           = excluded.ctr,
      cpc           = excluded.cpc,
      cpa           = excluded.cpa,
      source        = excluded.source
  `);
}

interface SnapshotRow {
  snapshot_date: string;
  campaign_id: string;
  campaign_name: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  source: string;
}

const toSnapshot = (r: SnapshotRow): CampaignSnapshot => ({
  snapshotDate: r.snapshot_date,
  campaignId: r.campaign_id,
  campaignName: r.campaign_name,
  platform: r.platform as Platform,
  spend: r.spend,
  impressions: r.impressions,
  clicks: r.clicks,
  conversions: r.conversions,
  ctr: r.ctr,
  cpc: r.cpc,
  cpa: r.cpa,
  source: r.source as DataSource,
});

const paramsFor = (s: CampaignSnapshot) => ({
  snapshot_date: s.snapshotDate,
  campaign_id: s.campaignId,
  campaign_name: s.campaignName,
  platform: s.platform,
  spend: s.spend,
  impressions: s.impressions,
  clicks: s.clicks,
  conversions: s.conversions,
  ctr: s.ctr,
  cpc: s.cpc,
  cpa: s.cpa,
  source: s.source,
});

/** Inserts/updates raw snapshot rows (used by the seed script). Returns count. */
export function insertSnapshots(snapshots: CampaignSnapshot[]): number {
  const d = getDb();
  const stmt = upsertStatement(d);
  const tx = d.transaction((rows: CampaignSnapshot[]) => {
    for (const s of rows) stmt.run(paramsFor(s));
  });
  tx(snapshots);
  return snapshots.length;
}

/**
 * Records today's snapshot for each campaign (at most one row per campaign per
 * day). `source` is taken from the platform the campaign came from.
 */
export function captureDailySnapshot(
  campaigns: CampaignMetrics[],
  sources: CampaignsResponse["sources"],
  date: string = todayUtc()
): number {
  const snapshots: CampaignSnapshot[] = campaigns.map((c) => ({
    snapshotDate: date,
    campaignId: c.campaignId,
    campaignName: c.campaignName,
    platform: c.platform,
    spend: c.spend,
    impressions: c.impressions,
    clicks: c.clicks,
    conversions: c.conversions,
    ctr: c.ctr,
    cpc: c.cpc,
    cpa: c.cpa,
    source: sources[c.platform]?.source ?? "mock",
  }));
  return insertSnapshots(snapshots);
}

/** All snapshots, oldest first; optionally filtered to one campaign. */
export function readHistory(campaignId?: string): CampaignSnapshot[] {
  const d = getDb();
  const rows = campaignId
    ? (d
        .prepare("SELECT * FROM snapshots WHERE campaign_id = ? ORDER BY snapshot_date")
        .all(campaignId) as SnapshotRow[])
    : (d
        .prepare("SELECT * FROM snapshots ORDER BY snapshot_date, campaign_id")
        .all() as SnapshotRow[]);
  return rows.map(toSnapshot);
}

/** CTR from ~lagDays ago per campaign, for the scoring engine's CTR-drop rule. */
export function readPreviousCtrMap(lagDays = 7): Record<string, number> {
  const all = readHistory();
  const latest = latestSnapshotDate(all);
  if (!latest) return {};
  return selectPreviousCtrMap(all, latest, lagDays);
}

/**
 * Seeds the provided rows only when the database has no history yet. Lets a
 * fresh deployment come up with sample data without a manual seed step.
 */
export function seedIfEmpty(makeRows: () => CampaignSnapshot[]): number {
  if (readHistory().length > 0) return 0;
  return insertSnapshots(makeRows());
}
