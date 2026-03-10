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
import "@/lib/env"; // validate env vars at startup
import { supabase } from "@/lib/supabase";
import { ETH_ADDRESS_RE } from "@/lib/validation";

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1A — Wallet-based request validation
    const walletAddress: string | undefined = body.walletAddress;
    if (!walletAddress || !ETH_ADDRESS_RE.test(walletAddress)) {
      return Response.json(
        { error: "Wallet connection required. Please connect your wallet." },
        { status: 401 }
      );
    }

    // 1B — Rate limiting (Supabase-backed, persists across deploys)
    const { data: rl, error: rlError } = await supabase.rpc("check_rate_limit", {
      wallet_addr: walletAddress,
    });
    if (rlError) {
      console.error("[rate-limit] Supabase RPC error:", rlError);
      // Fail open — don't block users if the rate-limit DB is down
    } else if (rl && !rl.allowed) {
      return Response.json(
        { error: `Rate limit exceeded. Try again in ${rl.retry_in_min} minutes.` },
        { status: 429 }
      );
    }

    const messages: UIMessage[] = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "messages field is required and must be a non-empty array" },
        { status: 400 }
      );
    }

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
      onError({ error }) {
        console.error("[streamText error]", error);
      },
    });

    return result.toUIMessageStreamResponse({
      onError(error) {
        console.error("[stream response error]", error);
        return "Something went wrong. Please try again.";
      },
    });
  } catch (err: unknown) {
    console.error("[/api/chat] Unhandled error:", err);

    // Anthropic SDK errors expose a status property
    const isAnthropicError =
      err instanceof Error &&
      (err.constructor.name.includes("Anthropic") ||
        err.constructor.name.includes("API") ||
        ("status" in err && typeof (err as Record<string, unknown>).status === "number"));

    if (isAnthropicError) {
      return Response.json(
        { error: "AI service temporarily unavailable" },
        { status: 502 }
      );
    }

    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
