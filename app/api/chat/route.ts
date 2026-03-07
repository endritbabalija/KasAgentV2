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

/* ------------------------------------------------------------------ */
/*  In-memory rate limiter (per wallet, 30 req / 15 min)              */
/* ------------------------------------------------------------------ */

const RATE_LIMIT = 30;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface RateBucket {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateBucket>();

// Periodically purge expired entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitMap) {
    if (now >= bucket.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

function checkRateLimit(wallet: string): { allowed: boolean; retryInMin?: number } {
  const now = Date.now();
  const key = wallet.toLowerCase();
  const bucket = rateLimitMap.get(key);

  if (!bucket || now >= bucket.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= RATE_LIMIT) {
    const retryInMin = Math.ceil((bucket.resetTime - now) / 60_000);
    return { allowed: false, retryInMin };
  }

  bucket.count++;
  return { allowed: true };
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

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

    // 1B — Rate limiting
    const { allowed, retryInMin } = checkRateLimit(walletAddress);
    if (!allowed) {
      return Response.json(
        { error: `Rate limit exceeded. Try again in ${retryInMin} minutes.` },
        { status: 429 }
      );
    }

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
