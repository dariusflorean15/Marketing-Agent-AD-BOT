import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AnalysisResult, CampaignMetrics } from "@adbot/shared-types";

// Prompt template lives in the shared prompt library package.
const TEMPLATE_PATH = path.resolve(
  process.cwd(),
  "../../packages/prompt-library/api-prompt-template.md"
);

function loadPrompts(campaigns: CampaignMetrics[]) {
  const template = readFileSync(TEMPLATE_PATH, "utf-8");
  const systemPart = template.split("## SYSTEM")[1]?.split("## USER")[0]?.trim();
  const userPart = template.split("## USER")[1]?.trim();
  if (!systemPart || !userPart) {
    throw new Error("api-prompt-template.md is missing ## SYSTEM or ## USER section");
  }
  return {
    system: systemPart,
    user: userPart.replace("{{CAMPAIGN_DATA}}", JSON.stringify(campaigns, null, 2)),
  };
}

/** Strip markdown fences if the model added them despite instructions. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

const VERDICTS = new Set(["healthy", "warning", "critical"]);

function validateResults(raw: unknown): AnalysisResult[] {
  if (!Array.isArray(raw)) throw new Error("Claude did not return a JSON array");
  return raw.map((r) => {
    if (
      typeof r?.campaignId !== "string" ||
      typeof r?.recommendation !== "string" ||
      typeof r?.score !== "number" ||
      !VERDICTS.has(r?.verdict)
    ) {
      throw new Error("Claude returned an item with missing/invalid fields");
    }
    return {
      campaignId: r.campaignId,
      campaignName: String(r.campaignName ?? r.campaignId),
      platform: r.platform === "google" ? "google" : "meta",
      score: Math.max(0, Math.min(100, Math.round(r.score))),
      verdict: r.verdict,
      recommendation: r.recommendation,
      generatedAt: typeof r.generatedAt === "string" ? r.generatedAt : new Date().toISOString(),
    };
  });
}

export async function analyzeWithClaude(
  campaigns: CampaignMetrics[]
): Promise<AnalysisResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("PASTE_")) {
    throw new Error("ANTHROPIC_API_KEY is not set in apps/api-server/.env");
  }

  const client = new Anthropic({ apiKey });
  const { system, user } = loadPrompts(campaigns);

  const message = await client.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
    max_tokens: 2000,
    temperature: 0.2,
    system,
    messages: [{ role: "user", content: user }],
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return validateResults(JSON.parse(extractJson(text)));
}
