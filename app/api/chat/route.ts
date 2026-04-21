import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL, MAX_LINES } from "@/lib/constants";
import { isMockMode, MOCK_CHAT_REPLY, streamStringAsSSE } from "@/lib/mock";

export const runtime = "nodejs";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatBody = {
  code: string;
  language: string;
  question: string;
  history?: ChatMessage[];
};

const SYSTEM_PROMPT =
  "You are a pair-programming assistant. Be concise, direct, and practical. Reference specific lines when helpful. Prefer short answers. Use plain text; markdown is okay.";

function sseEvent(delta: string): Uint8Array {
  return new TextEncoder().encode(
    `data: ${JSON.stringify({ delta })}\n\n`,
  );
}

function sseDone(): Uint8Array {
  return new TextEncoder().encode("data: [DONE]\n\n");
}

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const code = (body.code ?? "").toString();
  const language = (body.language ?? "javascript").toString();
  const question = (body.question ?? "").toString().trim();
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

  if (!question) {
    return new Response(JSON.stringify({ error: "Empty question" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

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
    return new Response(streamStringAsSSE(MOCK_CHAT_REPLY), {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
      },
    });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: ChatMessage[] = [
    ...history.filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    ),
    {
      role: "user",
      content: `Current file (language: ${language}):\n\`\`\`\n${code}\n\`\`\`\n\nQuestion: ${question}`,
    },
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const resp = await client.messages.stream({
          model: HAIKU_MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages,
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
        controller.enqueue(sseEvent(`\n\n_Error: ${msg}_`));
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
