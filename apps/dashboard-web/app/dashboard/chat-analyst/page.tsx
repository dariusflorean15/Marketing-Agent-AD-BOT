"use client";

import { useState } from "react";
import type {
  AnalysisResult,
  AnalyzeRunResponse,
  CampaignsResponse,
  Platform,
  PlatformSourceInfo,
  Verdict,
} from "@adbot/shared-types";

const API_URL = "http://localhost:4000";

const verdictBadge: Record<Verdict, string> = {
  healthy: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  critical: "bg-red-100 text-red-800",
};

const verdictAccent: Record<Verdict, string> = {
  healthy: "border-l-green-500",
  warning: "border-l-yellow-500",
  critical: "border-l-red-500",
};

const scoreColor: Record<Verdict, string> = {
  healthy: "text-green-600",
  warning: "text-yellow-600",
  critical: "text-red-600",
};

// Worst first, so problems surface at the top.
const verdictOrder: Record<Verdict, number> = { critical: 0, warning: 1, healthy: 2 };

const platformLabel = (p: Platform) => (p === "meta" ? "Meta Ads" : "Google Ads");

function SourceTag({ info }: { info: PlatformSourceInfo }) {
  const map: Record<PlatformSourceInfo["source"], { label: string; cls: string }> = {
    live: { label: "live data", cls: "bg-green-50 text-green-700 ring-green-600/20" },
    mock: { label: "sample data", cls: "bg-slate-100 text-slate-500 ring-slate-500/20" },
    error: { label: "error · using sample", cls: "bg-red-50 text-red-700 ring-red-600/20" },
  };
  const { label, cls } = map[info.source];
  return (
    <span
      title={info.detail}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

function SummaryBar({ results }: { results: AnalysisResult[] }) {
  const counts = results.reduce(
    (acc, r) => ({ ...acc, [r.verdict]: acc[r.verdict] + 1 }),
    { healthy: 0, warning: 0, critical: 0 } as Record<Verdict, number>
  );
  const chip = (n: number, label: string, cls: string) => (
    <span className={`rounded-full px-3 py-1 text-sm font-medium ${cls}`}>
      {n} {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chip(counts.critical, "critical", verdictBadge.critical)}
      {chip(counts.warning, "warning", verdictBadge.warning)}
      {chip(counts.healthy, "healthy", verdictBadge.healthy)}
      <span className="ml-auto text-sm text-slate-400">
        {results.length} campaign{results.length === 1 ? "" : "s"} analyzed
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 border-l-4 border-l-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-48 rounded bg-slate-200" />
          <div className="h-3 w-24 rounded bg-slate-100" />
        </div>
        <div className="h-8 w-12 rounded bg-slate-200" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-5/6 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function ChatAnalystPage() {
  const [results, setResults] = useState<AnalysisResult[] | null>(null);
  const [sources, setSources] = useState<CampaignsResponse["sources"] | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      // Run the Claude analysis and fetch the data-source info in parallel.
      const [analyzeRes, campaignsRes] = await Promise.all([
        fetch(`${API_URL}/api/analyze/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
        fetch(`${API_URL}/api/campaigns`),
      ]);

      if (!analyzeRes.ok) {
        const body = await analyzeRes.json().catch(() => null);
        throw new Error(body?.error ?? `API returned ${analyzeRes.status}`);
      }

      const data: AnalyzeRunResponse = await analyzeRes.json();
      setResults(data.results);
      setRanAt(new Date().toLocaleString());

      if (campaignsRes.ok) {
        const campaigns: CampaignsResponse = await campaignsRes.json();
        setSources(campaigns.sources);
      }
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

  const sorted = results
    ? [...results].sort(
        (a, b) => verdictOrder[a.verdict] - verdictOrder[b.verdict] || a.score - b.score
      )
    : null;

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold">Chat Analyst</h2>
      <p className="mt-2 text-slate-600">
        Claude reviews every ingested campaign and returns a health verdict and a
        plain-language recommendation. Problems are sorted to the top.
      </p>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Analyzing…" : results ? "Re-run analysis" : "Run Analysis"}
        </button>
        {ranAt && !loading && (
          <span className="text-sm text-slate-400">Last run {ranAt}</span>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}

      {loading && (
        <div className="mt-6 flex flex-col gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && sorted && (
        <>
          <div className="mt-6">
            <SummaryBar results={sorted} />
          </div>

          {sorted.length === 0 ? (
            <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              No campaigns came back. Check the Overview page — if both platforms
              show no data, there may be no active campaigns yet.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {sorted.map((r) => (
                <div
                  key={r.campaignId}
                  className={`rounded-xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm ${verdictAccent[r.verdict]}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{r.campaignName}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                          {platformLabel(r.platform)}
                        </span>
                        {sources && <SourceTag info={sources[r.platform]} />}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-2xl font-bold ${scoreColor[r.verdict]}`}>
                        {r.score}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${verdictBadge[r.verdict]}`}
                      >
                        {r.verdict}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{r.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !results && !error && (
        <p className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Click <span className="font-medium text-slate-700">Run Analysis</span> to
          have Claude score your campaigns. Each result shows a 0–100 health score,
          a verdict, and what to do about it.
        </p>
      )}
    </div>
  );
}
