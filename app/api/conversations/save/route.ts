import { supabase } from "@/lib/supabase";
import { withAuth } from "@/lib/api-handler";
import type { UIMessage } from "ai";

function generateTitle(messages: UIMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "New Chat";

  const textPart = firstUserMsg.parts?.find(
    (p): p is { type: "text"; text: string } => p.type === "text"
  );
  if (!textPart) return "New Chat";

  const text = textPart.text.trim();
  return text.length > 60 ? text.slice(0, 57) + "..." : text;
}

export const POST = withAuth(async (req, { wallet }) => {
  const body = await req.json();
  const conversationId: string | undefined = body.conversationId;
  const messages: UIMessage[] = body.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "No messages" }, { status: 400 });
  }

  let convoId = conversationId;

  if (!convoId) {
    // Create a new conversation
    const title = generateTitle(messages);
    const { data, error } = await supabase
      .from("conversations")
      .insert({ wallet_address: wallet, title })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[POST /api/conversations/save] create error:", error);
      return Response.json({ error: "Failed to create conversation" }, { status: 500 });
    }
    convoId = data.id;
  } else {
    // Verify ownership
    const { data: convo, error: convoError } = await supabase
      .from("conversations")
      .select("wallet_address")
      .eq("id", convoId)
      .maybeSingle();

    if (convoError) {
      console.error("[POST /api/conversations/save] ownership check error:", convoError);
      return Response.json({ error: "Failed to verify conversation" }, { status: 500 });
    }

    if (!convo) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (convo.wallet_address.toLowerCase() !== wallet) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update timestamp
    const { error: updateError } = await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convoId);

    if (updateError) {
      console.error("[POST /api/conversations/save] timestamp update error:", updateError);
      return Response.json({ error: "Failed to update conversation" }, { status: 500 });
    }
  }

  // Delete-then-insert: remove all old messages, then insert new ones.
  // This is idempotent — concurrent saves result in "last writer wins"
  // instead of producing duplicate messages.
  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", convoId);
  if (deleteError) {
    console.error("[POST /api/conversations/save] delete error:", deleteError);
    return Response.json({ error: "Failed to update messages" }, { status: 500 });
  }

  const rows = messages.map((m) => ({
    conversation_id: convoId,
    role: m.role,
    parts: m.parts,
  }));

  const { error: insertError } = await supabase.from("messages").insert(rows);
  if (insertError) {
    console.error("[POST /api/conversations/save] insert error:", insertError);
    return Response.json({ error: "Failed to save messages" }, { status: 500 });
  }

  return Response.json({ conversationId: convoId });
});
