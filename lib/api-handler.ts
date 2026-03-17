import { requireAuth } from "./auth-middleware";

type AuthedHandler = (
  req: Request,
  ctx: { wallet: string; params: Record<string, string> }
) => Promise<Response>;

export function withAuth(handler: AuthedHandler) {
  return async (
    req: Request,
    nextCtx?: { params?: Promise<Record<string, string>> }
  ) => {
    try {
      const authResult = await requireAuth(req);
      if (authResult instanceof Response) return authResult;
      const params = nextCtx?.params ? await nextCtx.params : {};
      return await handler(req, { wallet: authResult, params });
    } catch (err) {
      console.error("[API]", err);
      return Response.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
