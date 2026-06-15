// Standalone Anthropic key checker. Reads apps/api-server/.env, pings the API,
// and prints a plain-English result. No build step, no extra packages.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, ".env");

function readEnv(name) {
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

const key = readEnv("ANTHROPIC_API_KEY");
const model = readEnv("CLAUDE_MODEL") || "claude-haiku-4-5-20251001";

if (!key || key.startsWith("PASTE")) {
  console.log("NO KEY FOUND in apps/api-server/.env (ANTHROPIC_API_KEY is empty or still says PASTE).");
  process.exit(1);
}

console.log(`Found key: ${key.slice(0, 7)}...${key.slice(-4)} (length ${key.length})`);
console.log(`Testing with model: ${model}`);
console.log("Pinging Anthropic...\n");

try {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with the single word OK" }],
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (res.ok) {
    const text = body?.content?.[0]?.text ?? "(no text)";
    console.log(`SUCCESS - your key works. Claude replied: "${text.trim()}"`);
    process.exit(0);
  }

  const errType = body?.error?.type ?? "unknown";
  const errMsg = body?.error?.message ?? "(no message)";
  console.log(`FAILED - HTTP ${res.status} (${errType})`);
  console.log(`Anthropic says: ${errMsg}`);
  if (res.status === 401) console.log("\n-> The key is invalid, revoked, or pasted wrong. Make a new one at console.anthropic.com.");
  if (res.status === 400 && /model/i.test(errMsg)) console.log("\n-> The key is fine, but the model name is wrong. Tell me and I'll fix CLAUDE_MODEL.");
  if (res.status === 429 || /credit|balance|quota/i.test(errMsg)) console.log("\n-> The key is valid but the workspace has no credit. Add billing at console.anthropic.com.");
  process.exit(1);
} catch (err) {
  console.log(`COULD NOT CONNECT: ${err?.message ?? err}`);
  console.log("-> Check your internet connection and try again.");
  process.exit(1);
}
