# Ghostpair

**AI pair programmer that watches you type.** Browser-based editor with real-time bug detection and plain-English error explanations.

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind
- Monaco editor
- Anthropic Claude Haiku 4.5 (streaming)
- Server-sent events (SSE) for live feedback

## Features

- Debounced analysis: AI scans code 500ms after you stop typing
- Squiggly underlines + hover tooltips for detected issues
- "Ask the pair" chat sidebar for free-form questions about the current file
- Runtime-error explainer _(v2 — needs sandboxed execution)_

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # set ANTHROPIC_API_KEY
pnpm dev
```

Open http://localhost:3000.

## License

MIT
