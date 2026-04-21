// Client helper: consume an SSE-ish Response body and call `onDelta` with each
// text delta the server emits. The server wraps each chunk as
// `data: {"delta":"..."}\n\n` and terminates with `data: [DONE]\n\n`.

export async function readSSEStream(
  res: Response,
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => {});
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Split on double-newline event boundaries.
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload) as { delta?: string };
          if (typeof parsed.delta === "string") onDelta(parsed.delta);
        } catch {
          // ignore malformed events
        }
      }
      idx = buffer.indexOf("\n\n");
    }
  }
}

/** Small stable client-side hash (FNV-1a 32-bit). Good enough for skip-if-same. */
export function hashCode(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
