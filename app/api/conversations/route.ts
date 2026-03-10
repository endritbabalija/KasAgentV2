import { supabase } from "@/lib/supabase";
import { ETH_ADDRESS_RE } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");

    if (!wallet || !ETH_ADDRESS_RE.test(wallet)) {
      return Response.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("wallet_address", wallet.toLowerCase())
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[GET /api/conversations]", error);
      return Response.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }

    return Response.json(data);
  } catch (err) {
    console.error("[GET /api/conversations] Unhandled error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
