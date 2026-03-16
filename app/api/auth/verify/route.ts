import { verifySiweSignature, signWalletJWT, AUTH_COOKIE } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { message, signature } = await req.json();

    if (!message || !signature) {
      return Response.json({ error: "Missing message or signature" }, { status: 400 });
    }

    // Extract request domain for SIWE validation
    const host = req.headers.get("host");
    if (!host) {
      return Response.json({ error: "Missing host header" }, { status: 400 });
    }

    // 1. Verify SIWE signature + domain + chainId (proves wallet ownership)
    const { address, nonce } = await verifySiweSignature(message, signature, host);

    // 2. Atomically delete the nonce and verify it existed (prevents replay + TOCTOU race)
    const { data: deleted, error: deleteError } = await supabase
      .from("auth_sessions")
      .delete()
      .eq("wallet_address", address)
      .eq("nonce", nonce)
      .gt("expires_at", new Date().toISOString())
      .select("id");

    if (deleteError || !deleted || deleted.length === 0) {
      return Response.json({ error: "Invalid or expired nonce" }, { status: 401 });
    }

    // 3. Clean up any old expired sessions for this wallet
    await supabase
      .from("auth_sessions")
      .delete()
      .eq("wallet_address", address)
      .lt("expires_at", new Date().toISOString());

    // 4. Sign JWT with verified wallet address
    const token = await signWalletJWT(address);

    // 5. Set httpOnly cookie
    return Response.json(
      { address },
      {
        headers: {
          "Set-Cookie": `${AUTH_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`,
        },
      }
    );
  } catch (err) {
    console.error("[/api/auth/verify]", err);
    const msg = err instanceof Error ? err.message : "Verification failed";
    return Response.json({ error: msg }, { status: 401 });
  }
}
