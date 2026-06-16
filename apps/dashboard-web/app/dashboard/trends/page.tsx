"use client";

import { useEffect, useMemo, useState } from "react";
import type { CampaignSnapshot, HistoryResponse, Platform } from "@adbot/shared-types";
import { API_URL } from "@/app/lib/api";
import { LineChart } from "@/app/lib/LineChart";

type MetricKey = "ctr" | "spend" | "conversions";

const METRICS: Record<MetricKey, { label: string; color: string; format: (n: number) => string }> = {
  ctr: { label: "CTR", color: "#2563eb", format: (n) => `${(n * 100).toFixed(2)}%` },
  spend: { label: "Spend", color: "#d97706", format: (n) => `$${n.toFixed(0)}` },
  conversions: { label: "Conversions", color: "#16a34a", format: (n) => `${Math.round(n)}` },
};

const platformLabel = (p: Platform) => (p === "meta" ? "Meta Ads" : "Google Ads");

interface Series {
  campaignId: string;
  campaignName: string;
  platform: Platform;
  snapshots: CampaignSnapshot[];
}

/** Percent change of the latest value vs roughly `lag` days earlier. */
function change(series: CampaignSnapshot[], metric: MetricKey, lag = 7) {
  if (series.length === 0) return null;
  const latest = series[series.length - 1][metric];
  const prevIdx = Math.max(0, series.length - 1 - lag);
  const prev = series[prevIdx][metric];
  if (!prev) return null;
  return { latest, prev, pct: (latest - prev) / prev };
}

export default function TrendsPage() {
  const [snapshots, setSnapshots] = useState<CampaignSnapshot[] | null>(null);
  const [metric, setMetric] = useState<MetricKey>("ctr");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/history`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `API returned ${res.status}`);
        }
        return res.json() as Promise<HistoryResponse>;
      })
      .then((data) => setSnapshots(data.snapshots))
      .catch((e) =>
        setError(
          e instanceof Error
            ? `${e.message} — is the API server running on port 4000?`
            : "Unknown error"
        )
      );
  }, []);

  const series = useMemo<Series[]>(() => {
    if (!snapshots) return [];
    const byId = new Map<string, CampaignSnapshot[]>();
    for (const s of snapshots) {
      const arr = byId.get(s.campaignId) ?? [];
      arr.push(s);
      byId.set(s.campaignId, arr);
    }
    return [...byId.values()]
      .map((arr) => {
        const sorted = [...arr].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
        return {
          campaignId: sorted[0].campaignId,
          campaignName: sorted[0].campaignName,
          platform: sorted[0].platform,
          snapshots: sorted,
        };
      })
      .sort((a, b) => a.campaignName.localeCompare(b.campaignName));
  }, [snapshots]);

  const m = METRICS[metric];
  const dateRange =
    snapshots && snapshots.length
      ? `${snapshots[0].snapshotDate} → ${snapshots[snapshots.length - 1].snapshotDate}`
      : "";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Trends</h2>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(Object.keys(METRICS) as MetricKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                metric === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {METRICS[key].label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-slate-600">
        {m.label} per campaign over time{dateRange && `, ${dateRange}`}.
      </p>

      {error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {!snapshots && !error && <p className="mt-6 text-slate-400">Loading history…</p>}

      {snapshots && series.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          No history yet. Seed sample data with{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">npm run seed --workspace apps/api-server</code>{" "}
          or let it accumulate once campaigns are live.
        </p>
      )}

      {series.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {series.map((s) => {
            const c = change(s.snapshots, metric);
            const ctrChange = change(s.snapshots, "ctr");
            const ctrFalling = ctrChange !== null && ctrChange.pct < -0.25;
            const up = c !== null && c.pct >= 0;
            return (
              <div key={s.campaignId} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{s.campaignName}</h3>
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {platformLabel(s.platform)}
                    </p>
                  </div>
                  {ctrFalling && (
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
                      CTR falling
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold" style={{ color: m.color }}>
                    {c ? m.format(c.latest) : "—"}
                  </span>
                  {c && (
                    <span className={`text-sm font-medium ${up ? "text-green-600" : "text-red-600"}`}>
                      {up ? "▲" : "▼"} {Math.abs(c.pct * 100).toFixed(0)}% vs 7d ago
                    </span>
                  )}
                </div>

                <div className="mt-2">
                  <LineChart
                    points={s.snapshots.map((x) => ({ label: x.snapshotDate, value: x[metric] }))}
                    color={m.color}
                    format={m.format}
                    height={128}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
