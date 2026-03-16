import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  Client-side env (NEXT_PUBLIC_ — available in browser + server)     */
/* ------------------------------------------------------------------ */

const clientSchema = z.object({
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().min(1, "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required"),
  NEXT_PUBLIC_RPC_URL: z.string().url().default("https://evmrpc.kasplex.org"),
  NEXT_PUBLIC_RPC_URL_FALLBACK: z.string().url().optional(),
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
  NEXT_PUBLIC_RPC_URL_FALLBACK: process.env.NEXT_PUBLIC_RPC_URL_FALLBACK || undefined,
});

/* ------------------------------------------------------------------ */
/*  Server-side env (secret — only available on the server)           */
/* ------------------------------------------------------------------ */

const serverSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  EXPLORER_API_URL: z.string().url().default("https://explorer.kasplex.org/node-api/proxy/api/v2"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().min(1, "NEXT_PUBLIC_SUPABASE_URL is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
});

function getServerEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv must not be imported on the client");
  }
  return serverSchema.parse({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    EXPLORER_API_URL: process.env.EXPLORER_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    JWT_SECRET: process.env.JWT_SECRET,
  });
}

export const serverEnv = typeof window === "undefined" ? getServerEnv() : (null as never);
