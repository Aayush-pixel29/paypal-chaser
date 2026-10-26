import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { google } from "@ai-sdk/google";
import { env } from "@/lib/server/env";
import { getAgentTools } from "@/lib/server/agent/tools";
import { buildInstructions } from "@/lib/server/agent/instructions";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!env.ai.hasGeminiKey) {
    return Response.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY is not set in .env.local" },
      { status: 500 },
    );
  }

  const raw = await req.json();
  const rawMessages: UIMessage[] = raw.messages || [];

  const safeMessages: UIMessage[] = rawMessages.map((m: unknown) => {
    const msg = m as Record<string, unknown>;
    if (!msg.parts || !Array.isArray(msg.parts)) {
      const text = (msg.content as string) || (msg.text as string) || "";
      return {
        id: (msg.id as string) || "msg",
        role: ((msg.role as string) || "user") as "user" | "assistant" | "system",
        parts: [{ type: "text", text: typeof text === "string" ? text : JSON.stringify(text) }],
      } as UIMessage;
    }
    return msg as unknown as UIMessage;
  });

  const result = streamText({
    model: google(env.ai.geminiModel),
    instructions: buildInstructions(),
    messages: await convertToModelMessages(safeMessages),
    tools: getAgentTools(),
    // extract → (maybe) create_invoice → summarise
    stopWhen: isStepCount(4),
    onError: ({ error }) => console.error("[chat] stream error:", error),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
