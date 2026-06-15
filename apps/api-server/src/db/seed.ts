// Seeds ~4 weeks of realistic sample history so trends, period comparisons,
// and the CTR-drop rule have something to show before live data flows.
// Run with: npm run seed --workspace apps/api-server
import { mockCampaigns } from "../mock-data.js";
import { generateSyntheticHistory } from "./history.js";
import { getDb, insertSnapshots } from "./index.js";

const DAYS = 28;
const endDate = new Date().toISOString().slice(0, 10);

const rows = generateSyntheticHistory(mockCampaigns, DAYS, endDate);
const count = insertSnapshots(rows);

console.log(
  `✅ Seeded ${count} snapshot rows — ${DAYS} days x ${mockCampaigns.length} campaigns, ending ${endDate}.`
);
console.log("   (Marked as sample data; safe to re-run — it upserts, no duplicates.)");

getDb().close();
