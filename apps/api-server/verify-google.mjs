// Standalone Google Ads checker. Reads apps/api-server/.env, runs the same
// last-7-days query the app uses, and prints a plain-English result.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GoogleAdsApi } from "google-ads-api";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, ".env");

function env(name) {
  const text = readFileSync(envPath, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    if (line.slice(0, eq).trim() !== name) continue;
    return line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const cfg = {
  client_id: env("GOOGLE_ADS_CLIENT_ID"),
  client_secret: env("GOOGLE_ADS_CLIENT_SECRET"),
  developer_token: env("GOOGLE_ADS_DEVELOPER_TOKEN"),
  refresh_token: env("GOOGLE_ADS_REFRESH_TOKEN"),
  customer_id: env("GOOGLE_ADS_CUSTOMER_ID").replace(/-/g, ""),
};

for (const [k, v] of Object.entries(cfg)) {
  if (!v || v.startsWith("PASTE")) {
    console.log(`MISSING: ${k} is not set in .env`);
    process.exit(1);
  }
}
console.log(`Customer ID: ${cfg.customer_id}`);
console.log("Querying Google Ads (last 7 days, enabled campaigns)...\n");

try {
  const client = new GoogleAdsApi({
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    developer_token: cfg.developer_token,
  });
  const customer = client.Customer({
    customer_id: cfg.customer_id,
    refresh_token: cfg.refresh_token,
  });

  const rows = await customer.query(`
    SELECT campaign.id, campaign.name,
      metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_7_DAYS AND campaign.status = 'ENABLED'
  `);

  console.log(`SUCCESS - connected. Returned ${rows.length} enabled campaign(s).`);
  for (const r of rows.slice(0, 5)) {
    const spend = Number(r.metrics?.cost_micros ?? 0) / 1e6;
    console.log(`  - ${r.campaign?.name}: spend ${spend.toFixed(2)}, clicks ${r.metrics?.clicks ?? 0}`);
  }
  if (rows.length === 0) {
    console.log("  (No enabled campaigns with data in the last 7 days - connection works, just no live numbers yet.)");
  }
  process.exit(0);
} catch (err) {
  const msg = err?.message ?? String(err);
  const detail = err?.errors?.[0]?.message ?? err?.errors?.map?.((e) => e.message).join("; ") ?? "";
  console.log("FAILED to query Google Ads.");
  console.log(`Reason: ${detail || msg}`);
  const blob = `${msg} ${detail}`.toLowerCase();
  if (blob.includes("developer_token_not_approved") || blob.includes("test account"))
    console.log("\n-> Your developer token is at TEST access level. Apply for Basic access in the Ads API Center to read your real account.");
  else if (blob.includes("developer_token") && blob.includes("invalid"))
    console.log("\n-> The developer token looks wrong. Double-check it in the Ads API Center.");
  else if (blob.includes("user_permission_denied") || blob.includes("not have permission"))
    console.log("\n-> The authorized Google account can't access this Customer ID. Make sure you signed in with an account that has access to 904-100-7946.");
  else if (blob.includes("customer_not_found") || blob.includes("invalid_customer_id"))
    console.log("\n-> The Customer ID may be wrong, or it needs a manager (MCC) account set as login-customer-id.");
  else if (blob.includes("invalid_grant"))
    console.log("\n-> The refresh token is invalid/expired. Re-run the OAuth Playground step to mint a new one.");
  process.exit(1);
}
