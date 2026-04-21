// Helpers for detecting mock mode and producing canned streamed responses
// so the UI is demoable without an Anthropic API key.

export function isMockMode(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return true;
  const trimmed = key.trim();
  if (trimmed === "") return true;
  if (trimmed === "mock") return true;
  // Treat the placeholder exactly as copied from .env.example as mock.
  if (trimmed === "sk-ant-...") return true;
  return false;
}

export const MOCK_ANALYZE_ISSUES = [
  {
    line: 3,
    issue: "Debug `console.log` left in the code.",
    fix_suggestion: "Remove the `console.log` before shipping.",
  },
];

export const MOCK_CHAT_REPLY =
  "I'd factor out this loop, here's why: the body does two unrelated things (shape the record, then write it) which makes each change riskier and the intent harder to read. Pull the shaping out into a pure helper — now the loop is a one-liner and the helper is trivially testable.";

/** Stream a string token-by-token as an SSE-ish body. */
export function streamStringAsSSE(text: string, chunkSize = 8): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= text.length) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }
      const slice = text.slice(i, i + chunkSize);
      i += chunkSize;
      // Each SSE event is a JSON payload with a "delta" field so the client can
      // treat mock and real streams identically.
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ delta: slice })}\n\n`),
      );
      await new Promise((r) => setTimeout(r, 20));
    },
  });
}

/** Stream a JSON string all at once as a single SSE event, then DONE. */
export function streamJSONAsSSE(obj: unknown): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ delta: JSON.stringify(obj) })}\n\n`),
      );
      await new Promise((r) => setTimeout(r, 50));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}
