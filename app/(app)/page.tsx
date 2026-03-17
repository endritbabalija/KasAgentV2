import { cookies } from "next/headers";
import { Chat } from "@/components/chat/Chat";

export default async function NewChatPage() {
  await cookies(); // opt out of static caching — ensures fresh UUID on every navigation
  const id = crypto.randomUUID();
  return <Chat key={id} id={id} initialMessages={[]} />;
}
