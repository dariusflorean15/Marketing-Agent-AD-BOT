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

/** One campaign's metrics stored for a single day — the unit of history. */
export interface CampaignSnapshot {
  snapshotDate: string; // YYYY-MM-DD (one row per campaign per day)
  campaignId: string;
  campaignName: string;
  platform: Platform;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  source: DataSource; // whether this day's numbers were live or mock
}

/** Response shape of GET /api/history */
export interface HistoryResponse {
  snapshots: CampaignSnapshot[];
}

/** One turn in the Chat Analyst conversation. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Request body for POST /api/chat */
export interface ChatRequest {
  messages: ChatMessage[];
}

/** Response shape of POST /api/chat */
export interface ChatResponse {
  reply: string;
}

/** A thumbs up/down on a campaign's recommendation. */
export type FeedbackRating = "up" | "down";

/** Request body for POST /api/feedback */
export interface FeedbackRequest {
  campaignId: string;
  campaignName: string;
  rating: FeedbackRating;
  note?: string;
  recommendation?: string;
}

/** A stored feedback entry. */
export interface FeedbackEntry {
  id: number;
  campaignId: string;
  campaignName: string;
  rating: FeedbackRating;
  note: string;
  recommendation: string;
  createdAt: string; // ISO datetime
}

/** Response shape of GET /api/feedback */
export interface FeedbackListResponse {
  feedback: FeedbackEntry[];
}
