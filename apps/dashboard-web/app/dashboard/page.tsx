"use client";

import { useEffect, useState } from "react";
import type { CampaignsResponse, PlatformSourceInfo } from "@adbot/shared-types";

const API_URL = "http://localhost:4000";

const eur = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

function SourceBadge({ name, info }: { name: string; info: PlatformSourceInfo }) {
  const styles: Record<string, string> = {
    live: "bg-green-100 text-green-800",
    mock: "bg-slate-200 text-slate-600",
    error: "bg-red-100 text-red-800",
  };
  return (
    <span
      title={info.detail}
      className={`rounded-full px-3 py-1 text-xs font-medium ${styles[info.source]}`}
    >
      {name}: {info.source === "error" ? "error (using mock)" : info.source}
    </span>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<CampaignsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/campaigns`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `API returned ${res.status}`);
        }
        return res.json();
      })
      .then(setData)
      .catch((e) =>
        setError(
          e instanceof Error
            ? `${e.message} — is the API server running on port 4000?`
            : "Unknown error"
        )
      );
  }, []);

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

      {data && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Platform</th>
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
              {data.campaigns.map((c) => (
                <tr key={c.campaignId} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{c.campaignName}</td>
                  <td className="px-4 py-3">
                    {c.platform === "meta" ? "Meta" : "Google"}
                  </td>
                  <td className="px-4 py-3 text-right">{eur(c.spend)}</td>
                  <td className="px-4 py-3 text-right">{c.impressions.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{c.clicks.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{pct(c.ctr)}</td>
                  <td className="px-4 py-3 text-right">{eur(c.cpc)}</td>
                  <td className="px-4 py-3 text-right">{c.conversions}</td>
                  <td className="px-4 py-3 text-right">
                    {c.conversions > 0 ? eur(c.cpa) : "—"}
                  </td>
                </tr>
              ))}
              {data.campaigns.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
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
