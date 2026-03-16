import { supabase } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth-middleware";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const wallet = authResult;

    const { id } = await params;

    // Fetch conversation (verify ownership)
    const { data: convo, error: convoError } = await supabase
      .from("conversations")
      .select("id, title, wallet_address")
      .eq("id", id)
      .maybeSingle();

    if (convoError) {
      console.error("[GET /api/conversations/[id]]", convoError);
      return Response.json({ error: "Failed to fetch conversation" }, { status: 500 });
    }

    if (!convo) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    if (convo.wallet_address.toLowerCase() !== wallet) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch messages and execution states in parallel
    const [msgResult, execResult] = await Promise.all([
      supabase
        .from("messages")
        .select("id, role, parts, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("execution_states")
        .select("tool_call_id, state, tx_hash")
        .eq("conversation_id", id),
    ]);

    if (msgResult.error) {
      console.error("[GET /api/conversations/[id]]", msgResult.error);
      return Response.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    if (execResult.error) {
      console.error("[GET /api/conversations/[id]] execution states error:", execResult.error);
    }
    const executionStates: Record<string, { state: string; txHash?: string }> = {};
    if (execResult.data) {
      for (const row of execResult.data) {
        executionStates[row.tool_call_id] = {
          state: row.state,
          ...(row.tx_hash ? { txHash: row.tx_hash } : {}),
        };
      }
    }

    return Response.json({
      id: convo.id,
      title: convo.title,
      messages: msgResult.data.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
        createdAt: m.created_at,
      })),
      executionStates,
    });
  } catch (err) {
    console.error("[GET /api/conversations/[id]] Unhandled error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const wallet = authResult;

    const { id } = await params;

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
  } catch (err) {
    console.error("[DELETE /api/conversations/[id]] Unhandled error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
