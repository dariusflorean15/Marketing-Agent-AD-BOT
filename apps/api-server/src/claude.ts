import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AnalysisResult, CampaignMetrics, ChatMessage } from "@adbot/shared-types";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("PASTE_")) {
    throw new Error("ANTHROPIC_API_KEY is not set in apps/api-server/.env");
  }
  return new Anthropic({ apiKey });
}

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
  const client = getClient();
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

/**
 * Conversational analyst. Answers the user's questions using a JSON snapshot of
 * the campaigns (with their computed scores) as grounding context.
 */
export async function askAnalyst(
  messages: ChatMessage[],
  contextJson: string
): Promise<string> {
  const client = getClient();

  const system = [
    "You are AD BOT, a marketing analyst assistant inside an ad-performance dashboard.",
    "You are given a JSON snapshot of the user's current campaigns, each with its metrics and a computed health score (0-100), verdict, and any flagged issues.",
    "Answer the user's questions concisely and specifically: cite campaign names and real numbers from the data, and when asked for advice give concrete, actionable steps.",
    "Only use the data provided. If something isn't in the data, say so rather than guessing.",
    "Write in plain text with short paragraphs. Do not use markdown headers, tables, or bullet characters.",
    "",
    "CAMPAIGN DATA:",
    contextJson,
  ].join("\n");

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
    max_tokens: 1000,
    temperature: 0.3,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/**
 * Writes a short weekly executive summary of campaign health from the provided
 * data (campaigns + scores + trend + team feedback).
 */
export async function writeDigest(contextJson: string): Promise<string> {
  const client = getClient();

  const system = [
    "You are AD BOT, writing a brief weekly executive summary of ad-campaign health for a small marketing team.",
    "Use ONLY the data provided: current campaigns (with health score, verdict, flagged issues, and recent CTR trend) and recent team feedback.",
    "Structure your answer as four short paragraphs:",
    "1) One sentence on overall account health.",
    "2) What's working — 1-2 campaigns doing well, with real numbers.",
    "3) What needs attention now — the most urgent issues, each with a specific recommended action and the campaign name.",
    "4) A note on any notable trend or anything the team's feedback suggests you should weigh.",
    "Be concise and specific; cite campaign names and real numbers. Plain text only — no markdown headers, bullets, or tables.",
    "",
    "DATA:",
    contextJson,
  ].join("\n");

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
    max_tokens: 800,
    temperature: 0.3,
    system,
    messages: [{ role: "user", content: "Write this week's executive summary." }],
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}
