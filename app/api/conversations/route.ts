import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth-middleware";

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const wallet = authResult;

    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("wallet_address", wallet)
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
