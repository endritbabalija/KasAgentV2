import { supabase } from "@/lib/supabase";

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet || !ETH_ADDRESS_RE.test(wallet)) {
    return Response.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  // Fetch conversation (verify ownership)
  const { data: convo, error: convoError } = await supabase
    .from("conversations")
    .select("id, title, wallet_address")
    .eq("id", id)
    .single();

  if (convoError || !convo) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (convo.wallet_address.toLowerCase() !== wallet.toLowerCase()) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Fetch messages
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("id, role, parts, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("[GET /api/conversations/[id]]", msgError);
    return Response.json({ error: "Failed to fetch messages" }, { status: 500 });
  }

  return Response.json({
    id: convo.id,
    title: convo.title,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      parts: m.parts,
      createdAt: m.created_at,
    })),
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet || !ETH_ADDRESS_RE.test(wallet)) {
    return Response.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  // Verify ownership before deleting
  const { data: convo } = await supabase
    .from("conversations")
    .select("wallet_address")
    .eq("id", id)
    .single();

  if (!convo) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (convo.wallet_address.toLowerCase() !== wallet.toLowerCase()) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  // CASCADE will delete messages too
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[DELETE /api/conversations/[id]]", error);
    return Response.json({ error: "Failed to delete conversation" }, { status: 500 });
  }

  return Response.json({ success: true });
}
