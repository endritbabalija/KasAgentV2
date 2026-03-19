import { supabase } from "@/lib/supabase";
import type { ChatMessage } from "@/lib/types";
import type { SerializedPortfolio } from "@/lib/ai/serializers";
import type { SnapshotData } from "@/lib/ai/portfolio-diff";

export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "New Chat";

  const textPart = firstUserMsg.parts?.find(
    (p): p is { type: "text"; text: string } => p.type === "text"
  );
  if (!textPart) return "New Chat";

  const text = textPart.text.trim();
  return text.length > 60 ? text.slice(0, 57) + "..." : text;
}

export async function createConversation(
  id: string,
  wallet: string,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .upsert(
      { id, wallet_address: wallet, title },
      { onConflict: "id", ignoreDuplicates: true }
    );
  if (error)
    throw new Error(`Failed to create conversation: ${error.message}`);
}

export async function getConversationOwner(
  id: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("wallet_address")
    .eq("id", id)
    .maybeSingle();
  if (error)
    throw new Error(`Failed to check conversation owner: ${error.message}`);
  return data?.wallet_address?.toLowerCase() ?? null;
}

export async function saveMessage(
  conversationId: string,
  message: ChatMessage
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: message.role,
    parts: message.parts,
  });
  if (error) throw new Error(`Failed to save message: ${error.message}`);
}

export async function getMessages(
  conversationId: string
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, parts, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  return (data ?? []).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: m.parts,
  }));
}

export async function getConversationWithMessages(
  conversationId: string,
  wallet: string
): Promise<{
  messages: ChatMessage[];
  executionStates: Record<string, { state: string; txHash?: string }>;
} | null> {
  // Verify ownership
  const owner = await getConversationOwner(conversationId);
  if (!owner || owner !== wallet.toLowerCase()) return null;

  // Load messages
  const messages = await getMessages(conversationId);

  // Load execution states
  const { data: execData } = await supabase
    .from("execution_states")
    .select("tool_call_id, state, tx_hash")
    .eq("conversation_id", conversationId);

  const executionStates: Record<string, { state: string; txHash?: string }> =
    {};
  for (const row of execData ?? []) {
    executionStates[row.tool_call_id] = {
      state: row.state,
      txHash: row.tx_hash ?? undefined,
    };
  }

  return { messages, executionStates };
}

export async function getConversationCount(
  wallet: string
): Promise<number> {
  const { count, error } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("wallet_address", wallet);
  if (error) return 0; // fail open — don't block chat if count fails
  return count ?? 0;
}

export async function getExecutionStatesForConversation(
  conversationId: string
): Promise<Array<{ toolCallId: string; state: string; txHash?: string }>> {
  const { data } = await supabase
    .from("execution_states")
    .select("tool_call_id, state, tx_hash")
    .eq("conversation_id", conversationId);
  return (data ?? []).map((row) => ({
    toolCallId: row.tool_call_id,
    state: row.state,
    txHash: row.tx_hash ?? undefined,
  }));
}

export async function updateConversationTimestamp(
  conversationId: string
): Promise<void> {
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function conversationExists(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to check conversation: ${error.message}`);
  return data !== null;
}

export async function deleteLastAssistantMessages(
  conversationId: string
): Promise<void> {
  // Find the last user message's created_at
  const { data: lastUserMsg } = await supabase
    .from("messages")
    .select("created_at")
    .eq("conversation_id", conversationId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!lastUserMsg) return;

  // Delete all messages after the last user message (i.e. old assistant responses)
  await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", conversationId)
    .gt("created_at", lastUserMsg.created_at);
}

export async function upsertPortfolioSnapshot(
  wallet: string,
  portfolio: SerializedPortfolio
): Promise<void> {
  const { error } = await supabase.from("portfolio_snapshots").upsert(
    {
      wallet_address: wallet.toLowerCase(),
      balances: portfolio.balances,
      lp_positions: portfolio.lpPositions,
      farm_positions: portfolio.farmPositions,
      staking_positions: portfolio.stakingPositions,
      snapshot_at: new Date().toISOString(),
    },
    { onConflict: "wallet_address" }
  );
  if (error)
    throw new Error(`Failed to upsert portfolio snapshot: ${error.message}`);
}

export async function getPortfolioSnapshot(
  wallet: string
): Promise<SnapshotData | null> {
  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select(
      "balances, lp_positions, farm_positions, staking_positions, snapshot_at"
    )
    .eq("wallet_address", wallet.toLowerCase())
    .maybeSingle();
  if (error)
    throw new Error(`Failed to get portfolio snapshot: ${error.message}`);
  if (!data) return null;
  return {
    balances: (data.balances ?? []) as SnapshotData["balances"],
    lpPositions: (data.lp_positions ?? []) as SnapshotData["lpPositions"],
    farmPositions: (data.farm_positions ?? []) as SnapshotData["farmPositions"],
    stakingPositions:
      (data.staking_positions ?? []) as SnapshotData["stakingPositions"],
    snapshotAt: new Date(data.snapshot_at),
  };
}
