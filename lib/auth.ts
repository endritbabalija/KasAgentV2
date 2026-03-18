import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { SiweMessage } from "siwe";
import { serverEnv } from "./env";

const JWT_SECRET = new TextEncoder().encode(serverEnv.JWT_SECRET);
const JWT_ISSUER = "kasagent";
const JWT_EXPIRY = "3d";

/** Expected chain ID for Kasplex L2. */
export const EXPECTED_CHAIN_ID = 202555;

export interface WalletJWTPayload extends JWTPayload {
  wallet: string;
}

/** Sign a JWT containing the verified wallet address. */
export async function signWalletJWT(walletAddress: string): Promise<string> {
  return new SignJWT({ wallet: walletAddress.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

/** Verify a JWT and return the wallet address, or null if invalid. */
export async function verifyWalletJWT(
  token: string
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
    });
    const wallet = (payload as WalletJWTPayload).wallet;
    if (typeof wallet === "string" && wallet.startsWith("0x")) {
      return wallet;
    }
    return null;
  } catch {
    return null;
  }
}

/** Generate a random nonce for SIWE. */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify a SIWE message + signature with domain and chainId validation.
 * Returns the wallet address if valid, throws on any failure.
 */
export async function verifySiweSignature(
  message: string,
  signature: string,
  expectedDomain: string
): Promise<{ address: string; nonce: string }> {
  const siweMessage = new SiweMessage(message);

  // Validate domain matches our app (prevents cross-site SIWE replay)
  if (siweMessage.domain !== expectedDomain) {
    throw new Error("SIWE domain mismatch");
  }

  // Validate chain ID matches Kasplex L2
  if (siweMessage.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error("Wrong network. Please switch to Kasplex L2.");
  }

  const result = await siweMessage.verify({ signature });

  if (!result.success) {
    throw new Error("Invalid signature");
  }

  return {
    address: result.data.address.toLowerCase(),
    nonce: result.data.nonce,
  };
}

/** Cookie name for the auth JWT. */
export const AUTH_COOKIE = "kasagent-auth";
