import { supabase } from "@/lib/supabase";
import type { UIMessage } from "ai";

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const wallet: string | undefined = body.walletAddress;
    const conversationId: string | undefined = body.conversationId;
    const messages: UIMessage[] = body.messages;

    if (!wallet || !ETH_ADDRESS_RE.test(wallet)) {
      return Response.json({ error: "Invalid wallet" }, { status: 400 });
    }

    if (!messages || messages.length === 0) {
      return Response.json({ error: "No messages" }, { status: 400 });
    }

    let convoId = conversationId;

    if (!convoId) {
      // Create a new conversation
      const title = generateTitle(messages);
      const { data, error } = await supabase
        .from("conversations")
        .insert({ wallet_address: wallet.toLowerCase(), title })
        .select("id")
        .single();

      if (error || !data) {
        console.error("[POST /api/conversations/save] create error:", error);
        return Response.json({ error: "Failed to create conversation" }, { status: 500 });
      }
      convoId = data.id;
    } else {
      // Verify ownership
      const { data: convo } = await supabase
        .from("conversations")
        .select("wallet_address")
        .eq("id", convoId)
        .single();

      if (!convo || convo.wallet_address.toLowerCase() !== wallet.toLowerCase()) {
        return Response.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Update timestamp
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convoId);
    }

    // Delete old messages and re-insert all (simplest approach for consistency)
    await supabase.from("messages").delete().eq("conversation_id", convoId);

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
  } catch (err) {
    console.error("[POST /api/conversations/save]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
