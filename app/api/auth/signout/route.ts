import { AUTH_COOKIE } from "@/lib/auth";

export async function POST() {
  return Response.json(
    { success: true },
    {
      headers: {
        "Set-Cookie": `${AUTH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
      },
    }
  );
}
