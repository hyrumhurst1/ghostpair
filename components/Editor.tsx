"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef } from "react";
import type { Issue } from "@/lib/parseIssues";

type Props = {
  value: string;
  language: "javascript" | "python";
  onChange: (v: string) => void;
  issues: Issue[];
};

// Monaco's types aren't installed as a standalone package; we lean on the
// parameters of OnMount for typing and keep refs loosely typed.
type MonacoEditor = Parameters<OnMount>[0];
type MonacoNS = Parameters<OnMount>[1];

export default function CodeEditor({ value, language, onChange, issues }: Props) {
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<MonacoNS | null>(null);

  const handleMount: OnMount = useCallback((ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
  }, []);

  // Push markers whenever issues change.
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const model = ed.getModel();
    if (!model) return;

    const markers = issues.map((i) => {
      const lineNumber = Math.max(1, Math.min(model.getLineCount(), i.line));
      const lineLen = model.getLineMaxColumn(lineNumber);
      return {
        severity: monaco.MarkerSeverity.Warning,
        startLineNumber: lineNumber,
        startColumn: 1,
        endLineNumber: lineNumber,
        endColumn: lineLen,
        message: `${i.issue}\n\nFix: ${i.fix_suggestion}`,
        source: "Ghostpair",
      };
    });

    monaco.editor.setModelMarkers(model, "ghostpair", markers);
  }, [issues]);

  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={language}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        wordWrap: "off",
        automaticLayout: true,
        tabSize: 2,
      }}
    />
  );
}
