"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AnalysisResult,
  AnalyzeRunResponse,
  CampaignGoal,
  CampaignMetrics,
  CampaignSnapshot,
  CampaignsResponse,
  FeedbackRating,
  GoalsResponse,
  HistoryResponse,
  PlatformSourceInfo,
  Verdict,
} from "@adbot/shared-types";
import { API_URL } from "@/app/lib/api";
import { LineChart } from "@/app/lib/LineChart";

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

const DRAWER_METRICS = {
  ctr: { label: "CTR", color: "#2563eb", format: (n: number) => `${(n * 100).toFixed(2)}%` },
  spend: { label: "Spend", color: "#d97706", format: (n: number) => `$${n.toFixed(0)}` },
  conversions: { label: "Conversions", color: "#16a34a", format: (n: number) => `${Math.round(n)}` },
  roas: { label: "ROAS", color: "#7c3aed", format: (n: number) => `${n.toFixed(2)}×` },
} as const;
type DrawerMetric = keyof typeof DRAWER_METRICS;

const RULE_TITLES: Record<string, string> = {
  "ctr-floor": "Low CTR",
  "ctr-drop": "CTR falling",
  "cpa-high": "High CPA",
  "zero-conversions": "Wasted spend — no conversions",
  frequency: "Ad fatigue — high frequency",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

/** Thumbs up/down (+ optional note) on a recommendation; posts to /api/feedback. */
function FeedbackWidget({
  campaignId,
  campaignName,
  recommendation,
}: {
  campaignId: string;
  campaignName: string;
  recommendation: string;
}) {
  const [sent, setSent] = useState<FeedbackRating | null>(null);
  const [note, setNote] = useState("");

  async function submit(rating: FeedbackRating) {
    setSent(rating);
    try {
      await fetch(`${API_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, campaignName, rating, note, recommendation }),
      });
    } catch {
      /* best-effort; UI already shows thanks */
    }
  }

  if (sent) {
    return (
      <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
        ✓ Feedback saved — Claude will weigh it in the Chat Analyst next time.
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">Was this useful?</span>
        <div className="flex gap-1">
          <button onClick={() => submit("up")} className="rounded px-2 py-1 text-sm hover:bg-green-50" aria-label="Useful">
            👍
          </button>
          <button onClick={() => submit("down")} className="rounded px-2 py-1 text-sm hover:bg-red-50" aria-label="Not useful">
            👎
          </button>
        </div>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (why?) — included next time"
        className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

/** Edit a campaign's target ROAS / CPA; saving re-scores against the goals. */
function GoalEditor({
  campaignId,
  goal,
  onSaved,
}: {
  campaignId: string;
  goal?: CampaignGoal;
  onSaved: () => void;
}) {
  const [roas, setRoas] = useState(goal?.targetRoas?.toString() ?? "");
  const [cpa, setCpa] = useState(goal?.targetCpa?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`${API_URL}/api/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          targetRoas: roas ? Number(roas) : undefined,
          targetCpa: cpa ? Number(cpa) : undefined,
        }),
      });
      setSaved(true);
      onSaved();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Targets</h4>
      <div className="flex gap-3">
        <label className="flex-1 text-xs text-slate-500">
          Target ROAS (×)
          <input
            type="number"
            step="0.1"
            min="0"
            value={roas}
            onChange={(e) => setRoas(e.target.value)}
            placeholder="e.g. 3"
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="flex-1 text-xs text-slate-500">
          Target CPA ($)
          <input
            type="number"
            step="1"
            min="0"
            value={cpa}
            onChange={(e) => setCpa(e.target.value)}
            placeholder="e.g. 25"
            className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save targets"}
      </button>
      <p className="mt-1 text-xs text-slate-400">Scoring judges this campaign against your targets when set.</p>
    </div>
  );
}

/** Slide-out panel with a campaign's chart, metrics, score breakdown, and advice. */
function CampaignDrawer({
  campaign,
  scored,
  history,
  goal,
  onGoalSaved,
  onClose,
}: {
  campaign: CampaignMetrics;
  scored?: ScoredCampaign;
  history: CampaignSnapshot[] | null;
  goal?: CampaignGoal;
  onGoalSaved: () => void;
  onClose: () => void;
}) {
  const [metric, setMetric] = useState<DrawerMetric>("ctr");
  const m = DRAWER_METRICS[metric];
  const points = (history ?? []).map((h) => ({ label: h.snapshotDate, value: h[metric] }));

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-bold">{campaign.campaignName}</h3>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {campaign.platform === "meta" ? "Meta Ads" : "Google Ads"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 p-5">
          {scored && (
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold ${verdictText[scored.verdict]}`}>{scored.score}</span>
              <span className="text-sm text-slate-400">/100</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${verdictPill[scored.verdict]}`}>
                {scored.verdict}
              </span>
            </div>
          )}

          <div>
            <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
              {(Object.keys(DRAWER_METRICS) as DrawerMetric[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setMetric(k)}
                  className={`flex-1 rounded-md px-2 py-1 font-medium ${
                    metric === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {DRAWER_METRICS[k].label}
                </button>
              ))}
            </div>
            {history === null ? (
              <div className="flex h-[140px] items-center text-sm text-slate-400">Loading history…</div>
            ) : (
              <LineChart points={points} color={m.color} format={m.format} height={140} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Spend" value={eur(campaign.spend)} />
            <Stat label="Impressions" value={campaign.impressions.toLocaleString()} />
            <Stat label="Clicks" value={campaign.clicks.toLocaleString()} />
            <Stat label="CTR" value={pct(campaign.ctr)} />
            <Stat label="CPC" value={eur(campaign.cpc)} />
            <Stat label="Conversions" value={String(campaign.conversions)} />
            <Stat label="CPA" value={campaign.conversions > 0 ? eur(campaign.cpa) : "—"} />
            <Stat label="Conv. value" value={eur(campaign.conversionValue)} />
            <Stat label="ROAS" value={roasText(campaign)} />
          </div>

          <GoalEditor campaignId={campaign.campaignId} goal={goal} onSaved={onGoalSaved} />

          {scored?.penalties && scored.penalties.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Issues</h4>
              <ul className="space-y-2">
                {scored.penalties.map((p, i) => (
                  <li key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <div className="font-medium">{RULE_TITLES[p.rule] ?? p.rule}</div>
                    <div className="mt-0.5 text-slate-600">{p.detail}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {scored && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Recommendation</h4>
              <p className="text-sm text-slate-700">{scored.recommendation}</p>
              <FeedbackWidget
                campaignId={campaign.campaignId}
                campaignName={campaign.campaignName}
                recommendation={scored.recommendation}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type SortKey =
  | "name"
  | "score"
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "conversions"
  | "cpa"
  | "roas";

const roasText = (c: { conversionValue: number; roas: number }) =>
  c.conversionValue > 0 ? `${c.roas.toFixed(2)}×` : "—";

function SortHeader({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th
      onClick={() => onSort(k)}
      className={`cursor-pointer select-none px-4 py-3 hover:text-slate-600 ${
        align === "right" ? "text-right" : "text-left"
      } ${active ? "text-slate-700" : ""}`}
    >
      {label}
      {active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
    </th>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<CampaignsResponse | null>(null);
  const [scores, setScores] = useState<Record<string, ScoredCampaign>>({});
  const [goals, setGoals] = useState<Record<string, CampaignGoal>>({});
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CampaignMetrics | null>(null);
  const [history, setHistory] = useState<CampaignSnapshot[] | null>(null);

  async function openCampaign(c: CampaignMetrics) {
    setSelected(c);
    setHistory(null);
    try {
      const res = await fetch(`${API_URL}/api/history?campaignId=${encodeURIComponent(c.campaignId)}`);
      if (res.ok) {
        const body: HistoryResponse = await res.json();
        setHistory(body.snapshots);
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    }
  }

  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [campaignsRes, scoreRes, goalsRes] = await Promise.all([
        fetch(`${API_URL}/api/campaigns`),
        fetch(`${API_URL}/api/analyze/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch(() => null),
        fetch(`${API_URL}/api/goals`).catch(() => null),
      ]);

      if (goalsRes && goalsRes.ok) {
        const g: GoalsResponse = await goalsRes.json();
        setGoals(Object.fromEntries(g.goals.map((x) => [x.campaignId, x])));
      }

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
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} — is the API server running on port 4000?`
          : "Unknown error"
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    if (!data) return null;
    const totalSpend = data.campaigns.reduce((s, c) => s + c.spend, 0);
    const totalConversions = data.campaigns.reduce((s, c) => s + c.conversions, 0);
    const totalValue = data.campaigns.reduce((s, c) => s + c.conversionValue, 0);
    const blendedCpa = totalConversions > 0 ? totalSpend / totalConversions : null;
    const blendedRoas = totalSpend > 0 && totalValue > 0 ? totalValue / totalSpend : null;
    const scored = data.campaigns.map((c) => scores[c.campaignId]).filter(Boolean) as ScoredCampaign[];
    const avgScore =
      scored.length > 0 ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : null;
    const counts = scored.reduce(
      (acc, r) => ({ ...acc, [r.verdict]: acc[r.verdict] + 1 }),
      { healthy: 0, warning: 0, critical: 0 } as Record<Verdict, number>
    );
    return { totalSpend, totalConversions, blendedCpa, blendedRoas, avgScore, counts };
  }, [data, scores]);

  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState<"all" | Verdict>("all");

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  }

  const rows = useMemo(() => {
    if (!data) return [];
    let cs = data.campaigns;
    if (filter !== "all") cs = cs.filter((c) => scores[c.campaignId]?.verdict === filter);
    const val = (c: CampaignMetrics): number | string =>
      sortKey === "name"
        ? c.campaignName.toLowerCase()
        : sortKey === "score"
        ? scores[c.campaignId]?.score ?? -1
        : (c[sortKey] as number);
    return [...cs].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, scores, sortKey, sortDir, filter]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Overview</h2>
        <div className="flex items-center gap-2">
          {data && (
            <>
              <SourceBadge name="Meta" info={data.sources.meta} />
              <SourceBadge name="Google" info={data.sources.google} />
            </>
          )}
          <button
            onClick={load}
            disabled={refreshing}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-slate-600">
        Last 7 days, all platforms.
        {lastUpdated && <span className="text-slate-400"> · Updated {lastUpdated}</span>}
      </p>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}

      {!data && !error && <p className="mt-6 text-slate-400">Loading campaigns…</p>}

      {summary && (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <SummaryCard label="Total spend" value={eur(summary.totalSpend)} />
          <SummaryCard label="Conversions" value={summary.totalConversions.toLocaleString()} />
          <SummaryCard
            label="Blended CPA"
            value={summary.blendedCpa !== null ? eur(summary.blendedCpa) : "—"}
          />
          <SummaryCard
            label="Blended ROAS"
            value={summary.blendedRoas !== null ? `${summary.blendedRoas.toFixed(2)}×` : "—"}
            valueClass={
              summary.blendedRoas !== null
                ? summary.blendedRoas >= 2
                  ? "text-green-600"
                  : summary.blendedRoas >= 1
                  ? "text-yellow-600"
                  : "text-red-600"
                : ""
            }
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

      {data && data.campaigns.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Filter:</span>
          {(["all", "critical", "warning", "healthy"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                filter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {data && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <SortHeader label="Campaign" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 text-left">Platform</th>
                <SortHeader label="Health" k="score" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Spend" k="spend" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Impressions" k="impressions" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Clicks" k="clicks" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="CTR" k="ctr" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="CPC" k="cpc" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Conv." k="conversions" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="CPA" k="cpa" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="ROAS" k="roas" align="right" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const s = scores[c.campaignId];
                const ctrFalling = s?.penalties?.some((p) => p.rule === "ctr-drop");
                return (
                  <tr
                    key={c.campaignId}
                    onClick={() => openCampaign(c)}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
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
                    <td className="px-4 py-3 text-right">{roasText(c)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                    {filter === "all"
                      ? "No campaigns found in the last 7 days."
                      : `No ${filter} campaigns.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.sources.meta.source === "live" &&
        data.campaigns.filter((c) => c.platform === "meta").length === 0 && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <span className="font-medium">Meta is connected and live</span> — there are just no active
            campaigns in the last 7 days yet. Real Meta data will appear here once you&apos;re running ads.
          </div>
        )}
      {data && data.sources.google.source === "live" &&
        data.campaigns.filter((c) => c.platform === "google").length === 0 && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <span className="font-medium">Google is connected and live</span> — no active campaigns in the
            last 7 days yet.
          </div>
        )}

      {data && data.campaigns.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">Tip: click a campaign to see its trend and full breakdown.</p>
      )}

      {selected && (
        <CampaignDrawer
          campaign={selected}
          scored={scores[selected.campaignId]}
          history={history}
          goal={goals[selected.campaignId]}
          onGoalSaved={load}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
