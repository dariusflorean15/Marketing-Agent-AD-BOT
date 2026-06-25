import { GoogleAdsApi } from "google-ads-api";
import type { CampaignMetrics } from "@adbot/shared-types";

function clean(v: string | undefined): string {
  return (v ?? "").trim();
}

export function hasGoogleCreds(): boolean {
  const required = [
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "GOOGLE_ADS_CUSTOMER_ID",
  ];
  return required.every((name) => {
    const v = clean(process.env[name]);
    return v.length > 3 && !v.startsWith("PASTE");
  });
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Pulls last-7-days campaign metrics from the Google Ads API. */
export async function fetchGoogleCampaigns(): Promise<CampaignMetrics[]> {
  const client = new GoogleAdsApi({
    client_id: clean(process.env.GOOGLE_ADS_CLIENT_ID),
    client_secret: clean(process.env.GOOGLE_ADS_CLIENT_SECRET),
    developer_token: clean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN),
  });

  // When the developer token lives on a Manager (MCC) account but we query a
  // client account underneath it, the API requires login_customer_id = the
  // manager's ID. Set GOOGLE_ADS_LOGIN_CUSTOMER_ID to that manager account.
  const loginCustomerId = clean(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/-/g, "");

  const customer = client.Customer({
    customer_id: clean(process.env.GOOGLE_ADS_CUSTOMER_ID).replace(/-/g, ""),
    refresh_token: clean(process.env.GOOGLE_ADS_REFRESH_TOKEN),
    ...(loginCustomerId ? { login_customer_id: loginCustomerId } : {}),
  });

  const rows = await customer.query(`
    SELECT
      campaign.id,
      campaign.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date DURING LAST_7_DAYS
      AND campaign.status = 'ENABLED'
  `);

  return rows.map((row: any) => {
    const spend = Number(row.metrics?.cost_micros ?? 0) / 1_000_000;
    const impressions = Number(row.metrics?.impressions ?? 0);
    const clicks = Number(row.metrics?.clicks ?? 0);
    const conversions = Number(row.metrics?.conversions ?? 0);
    const conversionValue = Number(row.metrics?.conversions_value ?? 0);
    return {
      campaignId: `google-${row.campaign?.id}`,
      campaignName: String(row.campaign?.name ?? row.campaign?.id),
      platform: "google" as const,
      spend,
      impressions,
      clicks,
      conversions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpa: conversions > 0 ? spend / conversions : 0,
      conversionValue,
      roas: spend > 0 ? conversionValue / spend : 0,
      dateRangeStart: isoDaysAgo(7),
      dateRangeEnd: isoDaysAgo(0),
    };
  });
}
