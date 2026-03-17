import { computeInsights } from "@/lib/feed/compute-insights";
import type { SerializedPortfolio, SerializedInfinityPool } from "@/lib/ai/serializers";
import { withAuth } from "@/lib/api-handler";
import { supabase } from "@/lib/supabase";

const CACHE_TTL_SECONDS = 120; // 2 minutes

export const POST = withAuth(async (req, { wallet }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const portfolio = body.portfolio as SerializedPortfolio | null;
  const infinityPools = (body.infinityPools ?? []) as SerializedInfinityPool[];

  if (!portfolio?.address) {
    return Response.json([]);
  }

  // Check Supabase cache (works across serverless instances)
  const { data: cached } = await supabase
    .from("feed_cache")
    .select("insights, expires_at")
    .eq("wallet_address", wallet)
    .maybeSingle();

  if (cached && new Date(cached.expires_at) > new Date()) {
    return Response.json(cached.insights);
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

  return Response.json(insights);
});
