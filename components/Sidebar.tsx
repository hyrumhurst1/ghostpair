"use client";

import { useRef, useState } from "react";
import { readSSEStream } from "@/lib/sse";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Props = {
  getCode: () => string;
  language: string;
};

export default function Sidebar({ getCode, language }: Props) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setStreaming("");
    const nextHistory: ChatMessage[] = [...history, { role: "user", content: q }];
    setHistory(nextHistory);
    setQuestion("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: getCode(),
          language,
          question: q,
          history,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        setHistory((h) => [
          ...h,
          { role: "assistant", content: `Error: ${res.status} ${err}` },
        ]);
        return;
      }

      let acc = "";
      await readSSEStream(
        res,
        (delta) => {
          acc += delta;
          setStreaming(acc);
        },
        controller.signal,
      );
      setHistory((h) => [...h, { role: "assistant", content: acc }]);
      setStreaming("");
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setHistory((h) => [
          ...h,
          {
            role: "assistant",
            content: `Error: ${(err as Error).message || String(err)}`,
          },
        ]);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <aside className="flex h-full flex-col border-l border-[var(--border)] bg-[var(--panel)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="text-sm font-semibold">Ask the pair</div>
        <div className="text-xs text-[var(--muted)]">
          Free-form questions about the current file
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {history.length === 0 && !streaming && (
          <div className="text-xs text-[var(--muted)]">
            Try: &ldquo;What&rsquo;s off-by-one here?&rdquo; or &ldquo;Refactor
            this loop.&rdquo;
          </div>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "text-sm text-[var(--text)]"
                : "text-sm text-[var(--text)]/90 whitespace-pre-wrap"
            }
          >
            <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">
              {m.role}
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              {m.content}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="text-sm text-[var(--text)]/90 whitespace-pre-wrap">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--muted)]">
              assistant
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              {streaming}
              <span className="ml-1 animate-pulse">_</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <textarea
          className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          rows={3}
          placeholder="Ask about this file..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              ask();
            }
          }}
          disabled={busy}
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="text-[10px] text-[var(--muted)]">
            Cmd/Ctrl+Enter to send
          </div>
          <button
            onClick={ask}
            disabled={busy || !question.trim()}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? "Thinking..." : "Send"}
          </button>
        </div>
      </div>
    </aside>
  );
}
