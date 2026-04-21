"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Sidebar from "./Sidebar";
import { hashCode, readSSEStream } from "@/lib/sse";
import { parseIssuesLoose, type Issue } from "@/lib/parseIssues";
import { DEBOUNCE_MS, MAX_LINES } from "@/lib/constants";

const CodeEditor = dynamic(() => import("./Editor"), { ssr: false });

type Language = "javascript" | "python";

const STARTER: Record<Language, string> = {
  javascript: `// Welcome to Ghostpair — start typing, pause, and I'll flag bugs.
function total(items) {
  console.log("DEBUG:", items);
  let sum = 0;
  for (let i = 0; i <= items.length; i++) {
    sum += items[i].price;
  }
  return sum;
}
`,
  python: `# Welcome to Ghostpair — start typing, pause, and I'll flag bugs.
def total(items):
    print("DEBUG:", items)
    sum = 0
    for i in range(len(items) + 1):
        sum += items[i]["price"]
    return sum
`,
};

export default function Workbench() {
  const [language, setLanguage] = useState<Language>("javascript");
  const [code, setCode] = useState<string>(STARTER.javascript);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [status, setStatus] = useState<"idle" | "analyzing" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [mockMode, setMockMode] = useState<boolean>(false);
  const [tooLong, setTooLong] = useState<boolean>(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHashRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const codeRef = useRef<string>(code);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // Detect mock mode on mount.
  useEffect(() => {
    fetch("/api/mode")
      .then((r) => r.json())
      .then((d) => setMockMode(!!d.mock))
      .catch(() => setMockMode(false));
  }, []);

  const lineCount = useMemo(() => code.split("\n").length, [code]);

  const runAnalyze = useCallback(
    async (snapshot: string, lang: Language) => {
      const h = hashCode(`${lang}::${snapshot}`);
      if (h === lastHashRef.current) return;
      lastHashRef.current = h;

      if (snapshot.split("\n").length > MAX_LINES) {
        setTooLong(true);
        return;
      }
      setTooLong(false);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("analyzing");
      setStatusMsg("Scanning...");

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code: snapshot, language: lang }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          setStatus("error");
          setStatusMsg(`Error: ${res.status} ${t}`);
          return;
        }

        let buf = "";
        await readSSEStream(
          res,
          (delta) => {
            buf += delta;
            const parsed = parseIssuesLoose(buf);
            // Only update if the newly-parsed set differs from the current one
            // (avoid thrashing markers on every tiny delta).
            setIssues((prev) => {
              if (
                prev.length === parsed.length &&
                prev.every(
                  (p, i) =>
                    p.line === parsed[i].line &&
                    p.issue === parsed[i].issue &&
                    p.fix_suggestion === parsed[i].fix_suggestion,
                )
              ) {
                return prev;
              }
              return parsed;
            });
          },
          controller.signal,
        );

        // Final parse of the complete buffer.
        const finalIssues = parseIssuesLoose(buf);
        setIssues(finalIssues);
        setStatus("idle");
        setStatusMsg(
          finalIssues.length === 0
            ? "Clean."
            : `${finalIssues.length} issue${finalIssues.length > 1 ? "s" : ""}.`,
        );
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setStatus("error");
        setStatusMsg(`Error: ${(err as Error).message || String(err)}`);
      }
    },
    [],
  );

  // Debounced trigger on code/language change.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runAnalyze(codeRef.current, language);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [code, language, runAnalyze]);

  const switchLanguage = (next: Language) => {
    setLanguage(next);
    // If the editor still has the old starter content, swap to the new starter
    // so the demo is sensible. Otherwise leave the user's code alone.
    if (code === STARTER.javascript || code === STARTER.python) {
      setCode(STARTER[next]);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      {mockMode && (
        <div className="bg-amber-500 text-amber-950 text-xs font-medium px-4 py-1.5 text-center">
          Mock mode — set ANTHROPIC_API_KEY in .env.local to use real Claude
          Haiku 4.5.
        </div>
      )}
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold">Ghostpair</div>
          <div className="text-xs text-[var(--muted)]">
            AI pair programmer that watches you type
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-[var(--muted)]">Language</label>
          <select
            value={language}
            onChange={(e) => switchLanguage(e.target.value as Language)}
            className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
          </select>
          <button
            type="button"
            disabled
            title="v2: sandboxed execution"
            className="cursor-not-allowed rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--muted)] opacity-60"
          >
            Run (v2)
          </button>
          <div
            className={
              "text-xs " +
              (status === "error"
                ? "text-red-400"
                : status === "analyzing"
                  ? "text-amber-400"
                  : "text-[var(--muted)]")
            }
          >
            {statusMsg || "Ready."}
          </div>
        </div>
      </header>

      <div className="grid flex-1 min-h-0 grid-cols-[1fr_360px]">
        <div className="relative min-h-0">
          {tooLong && (
            <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
              Over {MAX_LINES} lines ({lineCount}). Trim the file to re-enable
              analysis.
            </div>
          )}
          <CodeEditor
            value={code}
            language={language}
            onChange={setCode}
            issues={issues}
          />
        </div>
        <Sidebar getCode={() => codeRef.current} language={language} />
      </div>
    </div>
  );
}
