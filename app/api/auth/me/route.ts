import { getAuthenticatedWallet } from "@/lib/auth-middleware";

export async function GET(req: Request) {
  try {
    const wallet = await getAuthenticatedWallet(req);
    if (!wallet) {
      return Response.json({ authenticated: false }, { status: 401 });
    }
    return Response.json({ authenticated: true, wallet });
  } catch (err) {
    console.error("[/api/auth/me]", err);
    return Response.json({ authenticated: false }, { status: 401 });
  }
}
