"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";

const EXPECTED_CHAIN_ID = 202555;

export type AuthStatus = "idle" | "signing" | "authenticated" | "error";

export function useWalletAuth() {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const prevAddressRef = useRef<string | undefined>(undefined);

  const signIn = useCallback(async () => {
    if (!address || !chainId) return;

    if (chainId !== EXPECTED_CHAIN_ID) {
      setError("Please switch to Kasplex L2 network.");
      setStatus("error");
      return;
    }

    setStatus("signing");
    setError(null);

    try {
      // 1. Get nonce from server
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!nonceRes.ok) {
        throw new Error("Failed to get nonce");
      }

      const { nonce } = await nonceRes.json();

      // 2. Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to KasAgent",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce,
      });

      const messageString = message.prepareMessage();

      // 3. Sign with wallet
      const signature = await signMessageAsync({ message: messageString });

      // 4. Verify on server (sets httpOnly cookie)
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageString, signature }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error(data.error || "Verification failed");
      }

      setStatus("authenticated");
    } catch (err) {
      console.error("[useWalletAuth] Sign-in failed:", err);
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      // User rejected the signature request
      if (msg.includes("rejected") || msg.includes("denied")) {
        setError("Signature rejected. Please sign to continue.");
      } else {
        setError(msg);
      }
      setStatus("error");
    }
  }, [address, chainId, signMessageAsync]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // Best effort
    }
    setStatus("idle");
  }, []);

  // Auto sign-in when wallet connects, sign-out when disconnects
  useEffect(() => {
    const addressChanged = prevAddressRef.current !== address;
    prevAddressRef.current = address;

    if (!isConnected || !address) {
      if (addressChanged && status === "authenticated") {
        signOut();
      }
      return;
    }

    // New wallet connected — need to sign in
    if (addressChanged && status !== "signing") {
      signIn();
    }
  }, [isConnected, address, status, signIn, signOut]);

  return {
    status,
    error,
    isAuthenticated: status === "authenticated",
    isSigning: status === "signing",
    signIn,
    signOut,
  };
}
