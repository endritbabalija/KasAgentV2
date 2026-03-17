import { supabase } from "@/lib/supabase";
import { withAuth } from "@/lib/api-handler";

export const DELETE = withAuth(async (req, { wallet, params }) => {
  const { id } = params;

  // Verify ownership
  const { data: convo, error: convoError } = await supabase
    .from("conversations")
    .select("wallet_address")
    .eq("id", id)
    .maybeSingle();

  if (convoError) {
    console.error("[DELETE /api/conversations/[id]]", convoError);
    return Response.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }

  if (!convo) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (convo.wallet_address.toLowerCase() !== wallet) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[DELETE /api/conversations/[id]]", error);
    return Response.json({ error: "Failed to delete conversation" }, { status: 500 });
  }

  return Response.json({ success: true });
});
