import { supabase } from "@/lib/supabase";
import type { UIMessage } from "ai";

export function generateTitle(messages: UIMessage[]): string {
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
  message: UIMessage
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
): Promise<UIMessage[]> {
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
  messages: UIMessage[];
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
