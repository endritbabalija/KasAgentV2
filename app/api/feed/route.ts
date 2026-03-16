import { NextResponse } from "next/server";
import { computeInsights } from "@/lib/feed/compute-insights";
import type { SerializedPortfolio, SerializedInfinityPool } from "@/lib/ai/serializers";
import { requireAuth } from "@/lib/auth-middleware";
import { supabase } from "@/lib/supabase";

const CACHE_TTL_SECONDS = 120; // 2 minutes

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const wallet = authResult;

    const body = await req.json();
    const portfolio = body.portfolio as SerializedPortfolio | null;
    const infinityPools = (body.infinityPools ?? []) as SerializedInfinityPool[];

    if (!portfolio?.address) {
      return NextResponse.json([]);
    }

    // Check Supabase cache (works across serverless instances)
    const { data: cached } = await supabase
      .from("feed_cache")
      .select("insights, expires_at")
      .eq("wallet_address", wallet)
      .maybeSingle();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return NextResponse.json(cached.insights);
    }

    const insights = computeInsights(portfolio, infinityPools);

    // Upsert cache
    const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString();
    await supabase
      .from("feed_cache")
      .upsert(
        { wallet_address: wallet, insights, expires_at: expiresAt },
        { onConflict: "wallet_address" }
      );

    return NextResponse.json(insights);
  } catch (err) {
    console.error("[Feed API] Error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
