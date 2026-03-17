import { AUTH_COOKIE } from "@/lib/auth";

export async function POST() {
  try {
    return Response.json(
      { success: true },
      {
        headers: {
          "Set-Cookie": `${AUTH_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
        },
      }
    );
  } catch (err) {
    console.error("[/api/auth/signout]", err);
    return Response.json({ error: "Sign out failed" }, { status: 500 });
  }
}
