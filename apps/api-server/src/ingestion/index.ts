import type { CampaignMetrics, CampaignsResponse, PlatformSourceInfo } from "@adbot/shared-types";
import { mockCampaigns } from "../mock-data.js";
import { fetchMetaCampaigns, hasMetaCreds } from "./meta.js";
import { fetchGoogleCampaigns, hasGoogleCreds } from "./google.js";

const mockFor = (platform: "meta" | "google") =>
  mockCampaigns.filter((c) => c.platform === platform);

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    const e = err as any;
    if (e?.message) return String(e.message);
    if (e?.errors?.[0]?.message) return String(e.errors[0].message);
    if (e?.details) return String(e.details);
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function loadPlatform(
  platform: "meta" | "google",
  hasCreds: () => boolean,
  fetchLive: () => Promise<CampaignMetrics[]>
): Promise<{ campaigns: CampaignMetrics[]; info: PlatformSourceInfo }> {
  if (!hasCreds()) {
    return { campaigns: mockFor(platform), info: { source: "mock" } };
  }
  try {
    return { campaigns: await fetchLive(), info: { source: "live" } };
  } catch (err) {
    const detail = serializeError(err);
    console.error(`\u26a0\ufe0f ${platform} ingestion failed, falling back to mock:`, detail);
    return { campaigns: mockFor(platform), info: { source: "error", detail } };
  }
}

/** Loads campaigns from both platforms: live where credentials exist, mock otherwise. */
export async function getAllCampaigns(): Promise<CampaignsResponse> {
  const [meta, google] = await Promise.all([
    loadPlatform("meta", hasMetaCreds, fetchMetaCampaigns),
    loadPlatform("google", hasGoogleCreds, fetchGoogleCampaigns),
  ]);

  return {
    campaigns: [...meta.campaigns, ...google.campaigns],
    sources: { meta: meta.info, google: google.info },
  };
}
