"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalysisResult, AnalyzeRunResponse, Platform } from "@adbot/shared-types";

const API_URL = "http://localhost:4000";

type Penalty = { rule: string; penalty: number; detail: string };
type ScoredCampaign = AnalysisResult & { penalties?: Penalty[] };
type Severity = "critical" | "warning" | "info";

interface Alert {
  campaignId: string;
  campaignName: string;
  platform: Platform;
  score: number;
  rule: string;
  title: string;
  detail: string;
  severity: Severity;
}

const RULE_TITLES: Record<string, string> = {
  "ctr-floor": "Low CTR",
  "ctr-drop": "CTR falling",
  "cpa-high": "High CPA",
  "zero-conversions": "Wasted spend — no conversions",
  frequency: "Ad fatigue — high frequency",
};

// Severity scales with how much the issue costs the score.
const severityFor = (penalty: number): Severity =>
  penalty >= 40 ? "critical" : penalty >= 20 ? "warning" : "info";

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

const SEVERITY_STYLE: Record<Severity, { dot: string; pill: string; border: string }> = {
  critical: { dot: "bg-red-500", pill: "bg-red-100 text-red-800", border: "border-l-red-500" },
  warning: { dot: "bg-yellow-500", pill: "bg-yellow-100 text-yellow-800", border: "border-l-yellow-500" },
  info: { dot: "bg-slate-400", pill: "bg-slate-200 text-slate-600", border: "border-l-slate-300" },
};

const platformLabel = (p: Platform) => (p === "meta" ? "Meta Ads" : "Google Ads");

export default function AlertsPage() {
  const [results, setResults] = useState<ScoredCampaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/analyze/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `API returned ${res.status}`);
        }
        return res.json() as Promise<AnalyzeRunResponse>;
      })
      .then((data) => setResults(data.results as ScoredCampaign[]))
      .catch((e) =>
        setError(
          e instanceof Error
            ? `${e.message} — is the API server running on port 4000?`
            : "Unknown error"
        )
      );
  }, []);

  const alerts = useMemo<Alert[]>(() => {
    if (!results) return [];
    const out: Alert[] = [];
    for (const r of results) {
      for (const p of r.penalties ?? []) {
        out.push({
          campaignId: r.campaignId,
          campaignName: r.campaignName,
          platform: r.platform,
          score: r.score,
          rule: p.rule,
          title: RULE_TITLES[p.rule] ?? p.rule,
          detail: p.detail,
          severity: severityFor(p.penalty),
        });
      }
    }
    return out.sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.score - b.score
    );
  }, [results]);

  const counts = useMemo(
    () =>
      alerts.reduce(
        (acc, a) => ({ ...acc, [a.severity]: acc[a.severity] + 1 }),
        { critical: 0, warning: 0, info: 0 } as Record<Severity, number>
      ),
    [alerts]
  );

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Alerts</h2>
        {results && alerts.length > 0 && (
          <div className="flex gap-2 text-sm">
            <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-800">
              {counts.critical} critical
            </span>
            <span className="rounded-full bg-yellow-100 px-3 py-1 font-medium text-yellow-800">
              {counts.warning} warning
            </span>
            <span className="rounded-full bg-slate-200 px-3 py-1 font-medium text-slate-600">
              {counts.info} info
            </span>
          </div>
        )}
      </div>
      <p className="mt-2 text-slate-600">Issues that need your attention, most urgent first.</p>

      {error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {!results && !error && <p className="mt-6 text-slate-400">Checking campaigns…</p>}

      {results && alerts.length === 0 && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6 text-sm text-green-800">
          ✅ All clear — no campaigns are flagging any issues right now.
        </div>
      )}

      {alerts.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {alerts.map((a, i) => {
            const style = SEVERITY_STYLE[a.severity];
            return (
              <div
                key={`${a.campaignId}-${a.rule}-${i}`}
                className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${style.border}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{a.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${style.pill}`}>
                          {a.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {a.campaignName} · {platformLabel(a.platform)}
                      </p>
                      <p className="mt-1.5 text-sm text-slate-700">{a.detail}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm text-slate-400">score {a.score}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
