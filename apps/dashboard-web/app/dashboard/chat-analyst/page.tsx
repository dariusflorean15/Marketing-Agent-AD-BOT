"use client";

import { useState } from "react";
import type { AnalysisResult, AnalyzeRunResponse } from "@adbot/shared-types";

const API_URL = "http://localhost:4000";

const verdictStyles: Record<AnalysisResult["verdict"], string> = {
  healthy: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  critical: "bg-red-100 text-red-800",
};

export default function ChatAnalystPage() {
  const [results, setResults] = useState<AnalysisResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/analyze/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `API returned ${res.status}`);
      }
      const data: AnalyzeRunResponse = await res.json();
      setResults(data.results);
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

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold">Chat Analyst</h2>
      <p className="mt-2 text-slate-600">
        Claude analyzes all ingested campaigns and returns recommendations.
        Check the Overview page badges to see which platforms are live vs mock
        data.
      </p>

      <button
        onClick={runAnalysis}
        disabled={loading}
        className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Analyzing…" : "Run Analysis"}
      </button>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {results && (
        <div className="mt-6 flex flex-col gap-4">
          {results.map((r) => (
            <div
              key={r.campaignId}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{r.campaignName}</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${verdictStyles[r.verdict]}`}
                >
                  {r.verdict} · {r.score}/100
                </span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                {r.platform === "meta" ? "Meta Ads" : "Google Ads"}
              </p>
              <p className="mt-3 text-sm text-slate-700">{r.recommendation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
