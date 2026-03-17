import { supabase } from "@/lib/supabase";
import { withAuth } from "@/lib/api-handler";

export const GET = withAuth(async (req, { wallet }) => {
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
});
