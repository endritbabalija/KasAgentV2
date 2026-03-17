import { redirect, notFound } from "next/navigation";
import { Chat } from "@/components/chat/Chat";
import { getServerWallet } from "@/lib/auth-server";
import { getConversationWithMessages } from "@/lib/db/queries";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const wallet = await getServerWallet();
  if (!wallet) redirect("/");

  const data = await getConversationWithMessages(id, wallet);
  if (!data) notFound();

  return (
    <Chat
      id={id}
      initialMessages={data.messages}
      initialExecutionStates={data.executionStates}
    />
  );
}
