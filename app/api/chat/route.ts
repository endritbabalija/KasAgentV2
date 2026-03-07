import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { aiTools } from "@/lib/ai/tools";
import type {
  SerializedPortfolio,
  SerializedInfinityPool,
} from "@/lib/ai/serializers";

export async function POST(req: Request) {
  const body = await req.json();

  const messages: UIMessage[] = body.messages;
  const portfolio: SerializedPortfolio | null = body.portfolio ?? null;
  const infinityPools: SerializedInfinityPool[] = body.infinityPools ?? [];

  const systemPrompt = await buildSystemPrompt(portfolio, infinityPools);

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages: modelMessages,
    tools: aiTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
