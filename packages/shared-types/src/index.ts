// Shared types used by both api-server and dashboard-web.
// This is the single source of truth for the data contract.

export type Platform = "meta" | "google";

export type Verdict = "healthy" | "warning" | "critical";

/** Normalized campaign metrics — same shape regardless of ad platform. */
export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  platform: Platform;
  spend: number; // in account currency
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number; // clicks / impressions
  cpc: number; // spend / clicks
  cpa: number; // spend / conversions
  dateRangeStart: string; // ISO date
  dateRangeEnd: string; // ISO date
}

/** One analyzed campaign with score + recommendation. */
export interface AnalysisResult {
  campaignId: string;
  campaignName: string;
  platform: Platform;
  score: number; // 0–100, higher = healthier
  verdict: Verdict;
  recommendation: string;
  generatedAt: string; // ISO datetime
}

/** Response shape of POST /api/analyze/run */
export interface AnalyzeRunResponse {
  results: AnalysisResult[];
}

/** Where each platform's data came from. */
export type DataSource = "live" | "mock" | "error";

export interface PlatformSourceInfo {
  source: DataSource;
  detail?: string; // error message when source === "error"
}

/** Response shape of GET /api/campaigns */
export interface CampaignsResponse {
  campaigns: CampaignMetrics[];
  sources: {
    meta: PlatformSourceInfo;
    google: PlatformSourceInfo;
  };
}
