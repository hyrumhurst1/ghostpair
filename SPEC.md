# Ghostpair — Build Spec

## Goal

Browser-based editor where AI flags bugs in real-time as you type.

## Stack (fixed for v1)

- Next.js 14 App Router, TypeScript, Tailwind
- Monaco editor (`@monaco-editor/react`)
- `@anthropic-ai/sdk` with streaming
- Server-sent events (SSE) for push updates

## MVP build order

1. Monaco editor on the page. Language dropdown (JavaScript, Python).
2. Client-side debounce: 500ms after last keystroke, POST current code to `/api/analyze`.
3. Server route hits Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) with streaming. Prompt: "Scan for bugs. Return JSON array of `{line, issue, fix_suggestion}`. Empty array if clean. Be fast, not thorough."
4. Parse streamed JSON, update editor decorations (squiggly underlines via `monaco.editor.IMarkerData`).
5. Hover on underline → tooltip shows issue + fix.
6. Sidebar: free-form "Ask the pair" chat. Sends current code + question to Claude. Render streamed response.

## Out of scope for v1 (EXPLICIT — DO NOT BUILD)

- **Do not** execute user code. Sandboxing is a rabbit hole (see Scalor's SPEC). Defer.
- Auth, saving, collaboration.
- Multi-file projects — single-file only.

## Model routing

- **Haiku 4.5** (`claude-haiku-4-5-20251001`) throughout. Latency > depth for this use case.

## Gotchas

- **Debounce aggressively** or you'll burn $50/day per user on API calls. 500ms minimum.
- **Hash the code** — don't re-analyze unchanged content.
- Cap code length at ~500 lines; refuse longer with a UI message.
- Stream incrementally; don't block on full response.
- Keep `ANTHROPIC_API_KEY` server-side only.
