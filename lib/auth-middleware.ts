import { verifyWalletJWT, AUTH_COOKIE } from "./auth";

/**
 * Extract and verify the authenticated wallet address from the request cookie.
 * Returns the lowercase wallet address or null if not authenticated.
 */
export async function getAuthenticatedWallet(
  req: Request
): Promise<string | null> {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  // Parse the auth cookie
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...rest] = c.trim().split("=");
      return [key, rest.join("=")];
    })
  );

  const token = cookies[AUTH_COOKIE];
  if (!token) return null;

  return verifyWalletJWT(token);
}

/**
 * Require authentication. Returns the wallet address or a 401 Response.
 */
export async function requireAuth(
  req: Request
): Promise<string | Response> {
  const wallet = await getAuthenticatedWallet(req);
  if (!wallet) {
    return Response.json(
      { error: "Authentication required. Please sign in with your wallet." },
      { status: 401 }
    );
  }
  return wallet;
}
