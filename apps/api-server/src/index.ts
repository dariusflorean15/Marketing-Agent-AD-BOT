import "dotenv/config";
import express from "express";
import cors from "cors";
import type { AnalyzeRunResponse } from "@adbot/shared-types";
import { analyzeWithClaude } from "./claude.js";
import { getAllCampaigns } from "./ingestion/index.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors()); // allow the dashboard (localhost:3000) to call us
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    service: "Marketing Agent AD BOT — API",
    endpoints: ["GET /api/health", "GET /api/campaigns", "POST /api/analyze/run"],
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "api-server", time: new Date().toISOString() });
});

// Normalized campaigns from both platforms (live where creds exist, mock otherwise).
app.get("/api/campaigns", async (_req, res) => {
  try {
    res.json(await getAllCampaigns());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ campaigns failed:", message);
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

app.listen(PORT, () => {
  console.log(`✅ api-server running at http://localhost:${PORT}`);
});
