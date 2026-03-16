import { generateNonce } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ETH_ADDRESS_RE } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const { address } = await req.json();

    if (!address || !ETH_ADDRESS_RE.test(address)) {
      return Response.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const wallet = address.toLowerCase();

    // Rate limit nonce generation (reuse existing rate limiter)
    const { data: rl, error: rlError } = await supabase.rpc("check_rate_limit", {
      wallet_addr: wallet,
    });
    if (rlError) {
      console.error("[auth/nonce] Rate limit check error:", rlError);
      return Response.json({ error: "Service temporarily unavailable" }, { status: 503 });
    }
    if (rl && !rl.allowed) {
      return Response.json(
        { error: `Too many requests. Try again in ${rl.retry_in_min} minutes.` },
        { status: 429 }
      );
    }

    const nonce = generateNonce();

    // Store nonce in DB (expires in 10 minutes)
    await supabase.from("auth_sessions").insert({
      wallet_address: wallet,
      nonce,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    return Response.json({ nonce });
  } catch (err) {
    console.error("[/api/auth/nonce]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
