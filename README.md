# Ghostpair

**AI pair programmer that watches you type.** Browser-based editor with real-time bug detection and a free-form "ask the pair" chat sidebar.

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind
- Monaco editor (`@monaco-editor/react`)
- Anthropic Claude Haiku 4.5 (streaming, SSE)

## Features

- Language dropdown: JavaScript or Python
- Debounced analysis: AI scans code 500ms after you stop typing
- Client-side FNV-1a hash skips re-analysis of unchanged code
- Squiggly underlines (Monaco markers) + hover tooltips for detected issues
- "Ask the pair" sidebar: free-form questions about the current file
- 500-line cap with a UI message when exceeded
- **Mock mode**: boots without an API key for UI demos
- Runtime-error explainer _(v2 — needs sandboxed execution)_

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # set ANTHROPIC_API_KEY (or leave as-is for mock mode)
pnpm dev
```

Open http://localhost:3000.

### Other commands

```bash
pnpm build   # production build (verified passing)
pnpm start   # run the production build
pnpm lint    # lint
```

## Mock mode

If `ANTHROPIC_API_KEY` is missing, empty, `mock`, or the placeholder `sk-ant-...`, the `/api/analyze` and `/api/chat` routes return canned streamed responses and the UI shows an amber "Mock mode" banner.

- `/api/analyze` flags a fake `console.log` on line 3 so you can see the squiggly + hover tooltip.
- `/api/chat` replies with a short canned refactor suggestion.

To demo without a key:

```bash
pnpm install
pnpm dev
# visit http://localhost:3000 — banner appears, squiggly on line 3 after 500ms.
```

## Constraints (v1)

- **No code execution.** No sandboxing, no `eval`, no subprocess. AI analysis only. The "Run" button is disabled with a "(v2)" label.
- Single-file only. No auth, no saving, no collaboration.

## License

MIT
