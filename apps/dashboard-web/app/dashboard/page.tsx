"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AnalysisResult,
  AnalyzeRunResponse,
  CampaignsResponse,
  PlatformSourceInfo,
  Verdict,
} from "@adbot/shared-types";
import { API_URL } from "@/app/lib/api";

const eur = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

// The score endpoint returns each result with its penalty breakdown; the shared
// type omits it, so we widen it locally to read the CTR-drop flag.
type ScoredCampaign = AnalysisResult & {
  penalties?: { rule: string; penalty: number; detail: string }[];
};

const verdictPill: Record<Verdict, string> = {
  healthy: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  critical: "bg-red-100 text-red-800",
};

const verdictText: Record<Verdict, string> = {
  healthy: "text-green-600",
  warning: "text-yellow-600",
  critical: "text-red-600",
};

const verdictFor = (score: number): Verdict =>
  score >= 70 ? "healthy" : score >= 40 ? "warning" : "critical";

// Renders the real data source reported by the API. "mock" is shown as
// "sample data" (plainer language), and an unrecognized/missing source falls
// back to a neutral "connected" label rather than implying live data.
function SourceBadge({ name, info }: { name: string; info: PlatformSourceInfo }) {
  const map: Record<string, { label: string; cls: string }> = {
    live: { label: "live", cls: "bg-green-100 text-green-800" },
    mock: { label: "sample data", cls: "bg-slate-200 text-slate-600" },
    error: { label: "live unavailable", cls: "bg-red-100 text-red-800" },
  };
  const { label, cls } = map[info?.source] ?? {
    label: "connected",
    cls: "bg-slate-200 text-slate-600",
  };
  return (
    <span
      title={info?.detail ?? "Source reported by the API"}
      className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}
    >
      {name}: {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  valueClass = "",
  sub,
}: {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<CampaignsResponse | null>(null);
  const [scores, setScores] = useState<Record<string, ScoredCampaign>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [campaignsRes, scoreRes] = await Promise.all([
          fetch(`${API_URL}/api/campaigns`),
          fetch(`${API_URL}/api/analyze/score`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }).catch(() => null),
        ]);

        if (!campaignsRes.ok) {
          const body = await campaignsRes.json().catch(() => null);
          throw new Error(body?.error ?? `API returned ${campaignsRes.status}`);
        }
        setData(await campaignsRes.json());

        if (scoreRes && scoreRes.ok) {
          const scoreData: AnalyzeRunResponse = await scoreRes.json();
          const map: Record<string, ScoredCampaign> = {};
          for (const r of scoreData.results as ScoredCampaign[]) map[r.campaignId] = r;
          setScores(map);
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? `${e.message} — is the API server running on port 4000?`
            : "Unknown error"
        );
      }
    }
    load();
  }, []);

  const summary = useMemo(() => {
    if (!data) return null;
    const totalSpend = data.campaigns.reduce((s, c) => s + c.spend, 0);
    const totalConversions = data.campaigns.reduce((s, c) => s + c.conversions, 0);
    const blendedCpa = totalConversions > 0 ? totalSpend / totalConversions : null;
    const scored = data.campaigns.map((c) => scores[c.campaignId]).filter(Boolean) as ScoredCampaign[];
    const avgScore =
      scored.length > 0 ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : null;
    const counts = scored.reduce(
      (acc, r) => ({ ...acc, [r.verdict]: acc[r.verdict] + 1 }),
      { healthy: 0, warning: 0, critical: 0 } as Record<Verdict, number>
    );
    return { totalSpend, totalConversions, blendedCpa, avgScore, counts };
  }, [data, scores]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Overview</h2>
        {data && (
          <div className="flex gap-2">
            <SourceBadge name="Meta" info={data.sources.meta} />
            <SourceBadge name="Google" info={data.sources.google} />
          </div>
        )}
      </div>
      <p className="mt-2 text-slate-600">Last 7 days, all platforms.</p>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}

      {!data && !error && <p className="mt-6 text-slate-400">Loading campaigns…</p>}

      {summary && (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard label="Total spend" value={eur(summary.totalSpend)} />
          <SummaryCard label="Conversions" value={summary.totalConversions.toLocaleString()} />
          <SummaryCard
            label="Blended CPA"
            value={summary.blendedCpa !== null ? eur(summary.blendedCpa) : "—"}
          />
          <SummaryCard
            label="Avg health"
            value={summary.avgScore !== null ? `${summary.avgScore}/100` : "—"}
            valueClass={summary.avgScore !== null ? verdictText[verdictFor(summary.avgScore)] : ""}
            sub={
              summary.avgScore !== null
                ? `${summary.counts.critical} critical · ${summary.counts.warning} warning · ${summary.counts.healthy} healthy`
                : undefined
            }
          />
        </div>
      )}

      {data && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3 text-right">Spend</th>
                <th className="px-4 py-3 text-right">Impressions</th>
                <th className="px-4 py-3 text-right">Clicks</th>
                <th className="px-4 py-3 text-right">CTR</th>
                <th className="px-4 py-3 text-right">CPC</th>
                <th className="px-4 py-3 text-right">Conv.</th>
                <th className="px-4 py-3 text-right">CPA</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => {
                const s = scores[c.campaignId];
                const ctrFalling = s?.penalties?.some((p) => p.rule === "ctr-drop");
                return (
                  <tr key={c.campaignId} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {c.campaignName}
                      {ctrFalling && (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700">
                          CTR ↓
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{c.platform === "meta" ? "Meta" : "Google"}</td>
                    <td className="px-4 py-3">
                      {s ? (
                        <span className="inline-flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${verdictPill[s.verdict]}`}>
                            {s.verdict}
                          </span>
                          <span className="text-slate-500">{s.score}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{eur(c.spend)}</td>
                    <td className="px-4 py-3 text-right">{c.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{c.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{pct(c.ctr)}</td>
                    <td className="px-4 py-3 text-right">{eur(c.cpc)}</td>
                    <td className="px-4 py-3 text-right">{c.conversions}</td>
                    <td className="px-4 py-3 text-right">{c.conversions > 0 ? eur(c.cpa) : "—"}</td>
                  </tr>
                );
              })}
              {data.campaigns.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No campaigns found in the last 7 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
