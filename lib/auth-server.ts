import "server-only";
import { cookies } from "next/headers";
import { verifyWalletJWT } from "@/lib/auth";

export async function getServerWallet(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("kasagent-auth")?.value;
  if (!token) return null;
  try {
    const wallet = await verifyWalletJWT(token);
    return wallet;
  } catch {
    return null;
  }
}
