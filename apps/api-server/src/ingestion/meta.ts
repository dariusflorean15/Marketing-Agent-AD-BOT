import type { CampaignMetrics } from "@adbot/shared-types";

const GRAPH_VERSION = "v21.0";

export function hasMetaCreds(): boolean {
  const token = process.env.META_ACCESS_TOKEN ?? "";
  const account = process.env.META_AD_ACCOUNT_ID ?? "";
  return token.length > 10 && !token.startsWith("PASTE") && account.length > 3 && !account.startsWith("PASTE");
}

interface MetaInsightRow {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
  date_start: string;
  date_stop: string;
}

const CONVERSION_ACTIONS = new Set([
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "lead",
  "offsite_conversion.fb_pixel_lead",
]);

function sumConversionActions(actions?: { action_type: string; value: string }[]): number {
  if (!actions) return 0;
  return actions
    .filter((a) => CONVERSION_ACTIONS.has(a.action_type))
    .reduce((sum, a) => sum + Number(a.value || 0), 0);
}

/** Pulls last-7-days campaign insights from the Meta Graph API. */
export async function fetchMetaCampaigns(): Promise<CampaignMetrics[]> {
  const token = process.env.META_ACCESS_TOKEN!;
  const rawAccount = process.env.META_AD_ACCOUNT_ID!;
  const account = rawAccount.startsWith("act_") ? rawAccount : `act_${rawAccount}`;

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${account}/insights`);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("date_preset", "last_7d");
  url.searchParams.set(
    "fields",
    "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values"
  );
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", token);

  const res = await fetch(url);
  const body = await res.json();

  if (!res.ok) {
    const msg = body?.error?.message ?? `Meta API returned ${res.status}`;
    throw new Error(`Meta: ${msg}`);
  }

  const rows: MetaInsightRow[] = body.data ?? [];

  return rows.map((row) => {
    const spend = Number(row.spend || 0);
    const impressions = Number(row.impressions || 0);
    const clicks = Number(row.clicks || 0);
    const conversions = sumConversionActions(row.actions);
    const conversionValue = sumConversionActions(row.action_values);
    return {
      campaignId: `meta-${row.campaign_id}`,
      campaignName: row.campaign_name,
      platform: "meta" as const,
      spend,
      impressions,
      clicks,
      conversions,
      ctr: impressions > 0 ? clicks / impressions : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      cpa: conversions > 0 ? spend / conversions : 0,
      conversionValue,
      roas: spend > 0 ? conversionValue / spend : 0,
      dateRangeStart: row.date_start,
      dateRangeEnd: row.date_stop,
    };
  });
}
