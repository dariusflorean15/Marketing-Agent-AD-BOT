"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeedbackEntry, FeedbackListResponse } from "@adbot/shared-types";
import { API_URL } from "@/app/lib/api";

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/feedback`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `API returned ${res.status}`);
        }
        return res.json() as Promise<FeedbackListResponse>;
      })
      .then((data) => setFeedback(data.feedback))
      .catch((e) =>
        setError(
          e instanceof Error
            ? `${e.message} — is the API server running on port 4000?`
            : "Unknown error"
        )
      );
  }, []);

  const counts = useMemo(() => {
    const up = feedback?.filter((f) => f.rating === "up").length ?? 0;
    const down = feedback?.filter((f) => f.rating === "down").length ?? 0;
    return { up, down };
  }, [feedback]);

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Feedback log</h2>
        {feedback && feedback.length > 0 && (
          <div className="flex gap-2 text-sm">
            <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-800">👍 {counts.up}</span>
            <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-800">👎 {counts.down}</span>
          </div>
        )}
      </div>
      <p className="mt-2 text-slate-600">
        Every thumbs up/down your team left on a recommendation. Claude weighs these in the Chat Analyst.
      </p>

      {error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {!feedback && !error && <p className="mt-6 text-slate-400">Loading feedback…</p>}

      {feedback && feedback.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          No feedback yet. Open a campaign on the Overview page and give its recommendation a 👍 or 👎.
        </p>
      )}

      {feedback && feedback.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {feedback.map((f) => (
            <div
              key={f.id}
              className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${
                f.rating === "up" ? "border-l-green-500" : "border-l-red-500"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg leading-none">{f.rating === "up" ? "👍" : "👎"}</span>
                  <div>
                    <h3 className="font-semibold">{f.campaignName}</h3>
                    {f.note && <p className="mt-0.5 text-sm text-slate-700">“{f.note}”</p>}
                    {f.recommendation && (
                      <p className="mt-1 text-xs text-slate-400">re: {f.recommendation}</p>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(f.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
