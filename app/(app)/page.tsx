import { Chat } from "@/components/chat/Chat";

export default function NewChatPage() {
  const id = crypto.randomUUID();
  return <Chat id={id} initialMessages={[]} />;
}
