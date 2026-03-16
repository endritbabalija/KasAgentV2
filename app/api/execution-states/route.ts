import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth-middleware";

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const wallet = authResult;

    const body = await req.json();
    const conversationId: string | undefined = body.conversationId;
    const toolCallId: string | undefined = body.toolCallId;
    const state: string | undefined = body.state;
    const txHash: string | undefined = body.txHash;

    if (!conversationId || !toolCallId || !state) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (state !== "success" && state !== "cancelled") {
      return Response.json({ error: "Invalid state" }, { status: 400 });
    }

    // Verify conversation ownership
    const { data: convo, error: convoError } = await supabase
      .from("conversations")
      .select("wallet_address")
      .eq("id", conversationId)
      .maybeSingle();

    if (convoError || !convo) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (convo.wallet_address.toLowerCase() !== wallet) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Upsert execution state
    const { error: upsertError } = await supabase
      .from("execution_states")
      .upsert(
        {
          conversation_id: conversationId,
          tool_call_id: toolCallId,
          state,
          tx_hash: txHash ?? null,
        },
        { onConflict: "conversation_id,tool_call_id" },
      );

    if (upsertError) {
      console.error("[POST /api/execution-states] upsert error:", upsertError);
      return Response.json({ error: "Failed to save execution state" }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[POST /api/execution-states]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
