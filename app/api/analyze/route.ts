import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL, MAX_LINES } from "@/lib/constants";
import { isMockMode, MOCK_ANALYZE_ISSUES, streamJSONAsSSE } from "@/lib/mock";

export const runtime = "nodejs";

type AnalyzeBody = {
  code: string;
  language: string;
};

const SYSTEM_PROMPT =
  "You are a fast code reviewer. Scan for bugs. Return ONLY a JSON array of objects with keys `line` (1-indexed integer), `issue` (short string), and `fix_suggestion` (short string). Return an empty array `[]` if the code is clean. Be fast, not thorough. No prose, no markdown fences — JSON only.";

function sseEvent(delta: string): Uint8Array {
  return new TextEncoder().encode(
    `data: ${JSON.stringify({ delta })}\n\n`,
  );
}

function sseDone(): Uint8Array {
  return new TextEncoder().encode("data: [DONE]\n\n");
}

export async function POST(req: Request) {
  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const code = (body.code ?? "").toString();
  const language = (body.language ?? "javascript").toString();

  const lineCount = code.split("\n").length;
  if (lineCount > MAX_LINES) {
    return new Response(
      JSON.stringify({
        error: `Code exceeds ${MAX_LINES}-line limit (got ${lineCount}).`,
      }),
      { status: 413, headers: { "content-type": "application/json" } },
    );
  }

  if (isMockMode()) {
    return new Response(streamJSONAsSSE(MOCK_ANALYZE_ISSUES), {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
      },
    });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const resp = await client.messages.stream({
          model: HAIKU_MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Language: ${language}\n\nCode:\n\`\`\`\n${code}\n\`\`\``,
            },
          ],
        });

        for await (const event of resp) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(sseEvent(event.delta.text));
          }
        }
        controller.enqueue(sseDone());
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown error";
        controller.enqueue(sseEvent(JSON.stringify({ __error: msg })));
        controller.enqueue(sseDone());
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
    },
  });
}
