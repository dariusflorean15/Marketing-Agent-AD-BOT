"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatRequest, ChatResponse } from "@adbot/shared-types";
import { API_URL } from "@/app/lib/api";

const SUGGESTIONS = [
  "Give me a quick health summary of all campaigns.",
  "Which campaign is wasting the most money?",
  "What should I fix first, and why?",
  "Why is Summer Sale – Prospecting flagged?",
];

export default function ChatAnalystPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const body: ChatRequest = { messages: nextMessages };
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error ?? `API returned ${res.status}`);
      }
      const data: ChatResponse = await res.json();
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
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

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] max-w-3xl flex-col">
      <div className="shrink-0">
        <h2 className="text-2xl font-bold">Chat Analyst</h2>
        <p className="mt-2 text-slate-600">
          Ask Claude anything about your campaigns. It can see the latest metrics
          and each campaign&apos;s health score.
        </p>
      </div>

      <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-1">
        {empty && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6">
            <p className="text-sm text-slate-500">Try one of these to start:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 bg-white text-slate-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" />
              </span>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>
        )}

        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4 flex shrink-0 items-center gap-2 border-t border-slate-200 pt-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your campaigns…"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
