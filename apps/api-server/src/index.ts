import "dotenv/config";
import express from "express";
import cors from "cors";
import type {
  AnalyzeRunResponse,
  ChatRequest,
  ChatResponse,
  DigestResponse,
  FeedbackListResponse,
  FeedbackRequest,
  HistoryResponse,
} from "@adbot/shared-types";
import { analyzeWithClaude, askAnalyst, writeDigest } from "./claude.js";
import { getAllCampaigns } from "./ingestion/index.js";
import { scoreCampaigns, type ScoringExtras } from "./scoring.js";
import {
  captureDailySnapshot,
  insertFeedback,
  readFeedback,
  readHistory,
  readPreviousCtrMap,
  seedIfEmpty,
} from "./db/index.js";
import { generateSyntheticHistory } from "./db/history.js";
import { mockCampaigns } from "./mock-data.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors()); // allow the dashboard (localhost:3000) to call us
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    service: "Marketing Agent AD BOT — API",
    endpoints: [
      "GET /api/health",
      "GET /api/campaigns",
      "GET /api/history",
      "POST /api/analyze/run",
      "POST /api/analyze/score",
      "POST /api/chat",
      "GET /api/feedback",
      "POST /api/feedback",
      "POST /api/digest",
    ],
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "api-server", time: new Date().toISOString() });
});

// Normalized campaigns from both platforms (live where creds exist, mock otherwise).
// Also records today's snapshot (at most one per campaign per day) so history builds up.
app.get("/api/campaigns", async (_req, res) => {
  try {
    const data = await getAllCampaigns();
    try {
      captureDailySnapshot(data.campaigns, data.sources);
    } catch (dbErr) {
      // Never let a storage hiccup break the campaigns response.
      console.error("⚠️ snapshot capture failed:", dbErr);
    }
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ campaigns failed:", message);
    res.status(500).json({ error: message });
  }
});

// Stored snapshot history for trends and comparisons. Optional ?campaignId filter.
app.get("/api/history", (req, res) => {
  try {
    const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId : undefined;
    const response: HistoryResponse = { snapshots: readHistory(campaignId) };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ history failed:", message);
    res.status(500).json({ error: message });
  }
});

// Runs the analysis: ingested metrics → Claude → recommendations.
app.post("/api/analyze/run", async (_req, res) => {
  try {
    const { campaigns } = await getAllCampaigns();
    const results = await analyzeWithClaude(campaigns);
    const response: AnalyzeRunResponse = { results };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ analyze/run failed:", message);
    res.status(500).json({ error: message });
  }
});

// Deterministic rule-based scoring — no Claude call, no API cost. Works on
// live or mock data and returns each campaign's score, verdict, and the
// transparent penalty breakdown behind it.
app.post("/api/analyze/score", async (_req, res) => {
  try {
    const { campaigns } = await getAllCampaigns();

    // Feed each campaign's CTR from ~a week ago so the CTR-drop rule can fire.
    let extras: Record<string, ScoringExtras> = {};
    try {
      const previousCtr = readPreviousCtrMap(7);
      extras = Object.fromEntries(
        Object.entries(previousCtr).map(([id, ctr]) => [id, { previousCtr: ctr }])
      );
    } catch (dbErr) {
      console.error("⚠️ previous-CTR lookup failed, scoring without it:", dbErr);
    }

    const results = scoreCampaigns(campaigns, extras);
    const response: AnalyzeRunResponse = { results };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ analyze/score failed:", message);
    res.status(500).json({ error: message });
  }
});

// Conversational analyst: answers questions using current campaigns + scores as context.
app.post("/api/chat", async (req, res) => {
  try {
    const body = req.body as ChatRequest;
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const valid = messages.filter(
      (m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string"
    );
    if (valid.length === 0) {
      res.status(400).json({ error: "Provide at least one message." });
      return;
    }

    const { campaigns } = await getAllCampaigns();

    // Score the campaigns so Claude can reference health, verdicts, and issues.
    let extras: Record<string, ScoringExtras> = {};
    try {
      const previousCtr = readPreviousCtrMap(7);
      extras = Object.fromEntries(
        Object.entries(previousCtr).map(([id, ctr]) => [id, { previousCtr: ctr }])
      );
    } catch {
      /* no history yet — score without trend context */
    }
    const scored = scoreCampaigns(campaigns, extras);
    const context = campaigns.map((c) => {
      const s = scored.find((x) => x.campaignId === c.campaignId);
      return {
        ...c,
        score: s?.score,
        verdict: s?.verdict,
        issues: s?.penalties.map((p) => p.rule) ?? [],
      };
    });

    // Include the team's recent thumbs up/down so Claude adapts to their judgment.
    let feedbackBlock = "";
    try {
      const fb = readFeedback(20);
      if (fb.length > 0) {
        feedbackBlock =
          "\n\nTEAM FEEDBACK ON PAST RECOMMENDATIONS (most recent first) — weight these when advising:\n" +
          fb
            .map(
              (f) =>
                `- [${f.rating === "up" ? "👍 agreed" : "👎 disagreed"}] ${f.campaignName}` +
                (f.note ? ` — note: "${f.note}"` : "") +
                (f.recommendation ? ` (re: "${f.recommendation}")` : "")
            )
            .join("\n");
      }
    } catch {
      /* feedback is optional context */
    }

    const reply = await askAnalyst(valid, JSON.stringify(context, null, 2) + feedbackBlock);
    const response: ChatResponse = { reply };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ chat failed:", message);
    res.status(500).json({ error: message });
  }
});

// Records a thumbs up/down (with optional note) on a campaign's recommendation.
app.post("/api/feedback", (req, res) => {
  try {
    const body = req.body as FeedbackRequest;
    if (!body?.campaignId || (body.rating !== "up" && body.rating !== "down")) {
      res.status(400).json({ error: "campaignId and rating ('up'|'down') are required." });
      return;
    }
    const id = insertFeedback({
      campaignId: body.campaignId,
      campaignName: String(body.campaignName ?? body.campaignId),
      rating: body.rating,
      note: typeof body.note === "string" ? body.note : "",
      recommendation: typeof body.recommendation === "string" ? body.recommendation : "",
    });
    res.json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ feedback save failed:", message);
    res.status(500).json({ error: message });
  }
});

// Recent feedback, newest first.
app.get("/api/feedback", (_req, res) => {
  try {
    const response: FeedbackListResponse = { feedback: readFeedback(100) };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ feedback list failed:", message);
    res.status(500).json({ error: message });
  }
});

// Claude-written weekly executive summary from campaigns + scores + trend + feedback.
app.post("/api/digest", async (_req, res) => {
  try {
    const { campaigns } = await getAllCampaigns();

    let prev: Record<string, number> = {};
    try {
      prev = readPreviousCtrMap(7);
    } catch {
      /* no history yet */
    }
    const extras: Record<string, ScoringExtras> = Object.fromEntries(
      Object.entries(prev).map(([id, ctr]) => [id, { previousCtr: ctr }])
    );
    const scored = scoreCampaigns(campaigns, extras);

    const ctxCampaigns = campaigns.map((c) => {
      const s = scored.find((x) => x.campaignId === c.campaignId);
      const p = prev[c.campaignId];
      return {
        campaignName: c.campaignName,
        platform: c.platform,
        spend: c.spend,
        conversions: c.conversions,
        ctr: c.ctr,
        cpa: c.cpa,
        score: s?.score,
        verdict: s?.verdict,
        issues: s?.penalties.map((x) => x.rule) ?? [],
        ctrChangePctVs7dAgo: p ? Math.round(((c.ctr - p) / p) * 100) : null,
      };
    });

    let feedback: { campaign: string; rating: string; note: string }[] = [];
    try {
      feedback = readFeedback(20).map((f) => ({ campaign: f.campaignName, rating: f.rating, note: f.note }));
    } catch {
      /* feedback optional */
    }

    const summary = await writeDigest(JSON.stringify({ campaigns: ctxCampaigns, feedback }, null, 2));
    const response: DigestResponse = { summary, generatedAt: new Date().toISOString() };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ digest failed:", message);
    res.status(500).json({ error: message });
  }
});

// On a fresh database (e.g. a new deployment), come up with sample history so
// trends, alerts, and the CTR-drop rule have data immediately.
try {
  const today = new Date().toISOString().slice(0, 10);
  const seeded = seedIfEmpty(() => generateSyntheticHistory(mockCampaigns, 28, today));
  if (seeded > 0) console.log(`🌱 Seeded ${seeded} sample snapshot rows on first run.`);
} catch (err) {
  console.error("⚠️ startup seed skipped:", err);
}

app.listen(PORT, () => {
  console.log(`✅ api-server running at http://localhost:${PORT}`);
});
