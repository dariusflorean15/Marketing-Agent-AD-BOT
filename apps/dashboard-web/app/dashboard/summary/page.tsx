"use client";

import { useState } from "react";
import type { DigestResponse } from "@adbot/shared-types";
import { API_URL } from "@/app/lib/api";

export default function SummaryPage() {
  const [summary, setSummary] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [slackMsg, setSlackMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/digest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `API returned ${res.status}`);
      }
      const data: DigestResponse = await res.json();
      setSummary(data.summary);
      setGeneratedAt(new Date(data.generatedAt).toLocaleString());
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} — is the API server running on port 4000?`
          : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendSlack() {
    setSending(true);
    setSlackMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/digest/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `API returned ${res.status}`);
      }
      setSlackMsg({ ok: true, text: "Sent to Slack ✓" });
    } catch (e) {
      setSlackMsg({ ok: false, text: e instanceof Error ? e.message : "Failed to send" });
    } finally {
      setSending(false);
    }
  }

  async function copy() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold">Weekly Summary</h2>
      <p className="mt-2 text-slate-600">
        A one-click executive summary Claude writes from your campaigns, scores, trends, and team
        feedback. Copy it into an email or Slack to share with the team.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Writing…" : summary ? "Regenerate" : "Generate summary"}
        </button>
        <button
          onClick={sendSlack}
          disabled={sending}
          className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send to Slack"}
        </button>
        {generatedAt && !loading && <span className="text-sm text-slate-400">Generated {generatedAt}</span>}
      </div>
      {slackMsg && (
        <p className={`mt-3 text-sm ${slackMsg.ok ? "text-green-600" : "text-red-600"}`}>{slackMsg.text}</p>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {loading && (
        <div className="mt-6 animate-pulse space-y-3 rounded-xl border border-slate-200 bg-white p-6">
          <div className="h-3 w-3/4 rounded bg-slate-100" />
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="h-3 w-5/6 rounded bg-slate-100" />
          <div className="h-3 w-2/3 rounded bg-slate-100" />
        </div>
      )}

      {!loading && summary && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex justify-end">
            <button
              onClick={copy}
              className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{summary}</p>
        </div>
      )}

      {!loading && !summary && !error && (
        <p className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Click <span className="font-medium text-slate-700">Generate summary</span> to have Claude write
          this week&apos;s campaign-health rundown.
        </p>
      )}
    </div>
  );
}
