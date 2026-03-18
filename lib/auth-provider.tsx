"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { SiweMessage } from "siwe";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";

// --- AuthContext: exposed to the rest of the app ---

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  handleSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue>(null!);

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// --- AuthProvider: auto-signs SIWE immediately after wallet connects ---

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address, chainId, isReconnecting } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");

  // All mutable state lives in refs so async flows never go stale
  const isSigningRef = useRef(false);
  const checkedAddressRef = useRef<string | null>(null);
  const addressRef = useRef(address);
  const chainIdRef = useRef(chainId);
  const signMessageRef = useRef(signMessageAsync);
  const disconnectRef = useRef(disconnect);

  useLayoutEffect(() => {
    addressRef.current = address;
    chainIdRef.current = chainId;
    signMessageRef.current = signMessageAsync;
    disconnectRef.current = disconnect;
  });

  // --- Single sign flow: session check → SIWE sign ---

  async function startAuthFlow(addr: string) {
    // Guard: one sign flow at a time
    if (isSigningRef.current) return;
    isSigningRef.current = true;

    try {
      // 1. Check existing session
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const data = await meRes.json();
        if (data.wallet?.toLowerCase() === addr.toLowerCase()) {
          setAuthStatus("authenticated");
          return;
        }
      }

      // 2. No valid session — get nonce
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      if (!nonceRes.ok) throw new Error("Failed to get nonce");
      const { nonce } = await nonceRes.json();

      // 3. Create SIWE message + prompt wallet signature directly
      const message = new SiweMessage({
        domain: window.location.host,
        address: addr,
        statement: "Sign in to KasAgent",
        uri: window.location.origin,
        version: "1",
        chainId: chainIdRef.current ?? 202555,
        nonce,
      }).prepareMessage();

      const signature = await signMessageRef.current({ message });

      // 4. Verify on server
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (verifyRes.ok) {
        setAuthStatus("authenticated");
      } else {
        disconnectRef.current();
        setAuthStatus("unauthenticated");
      }
    } catch {
      // User rejected signature or network error — disconnect cleanly
      disconnectRef.current();
      checkedAddressRef.current = null;
      setAuthStatus("unauthenticated");
    } finally {
      isSigningRef.current = false;
    }
  }

  // --- Trigger on wallet connect (address change only) ---

  useEffect(() => {
    if (isReconnecting) return;

    if (!address) {
      checkedAddressRef.current = null;
      setAuthStatus("unauthenticated");
      return;
    }

    const lower = address.toLowerCase();
    if (checkedAddressRef.current === lower) return;
    checkedAddressRef.current = lower;

    setAuthStatus("loading");
    startAuthFlow(address);
  }, [isReconnecting, address]);

  // --- 401 handler: re-triggers sign if not already in progress ---
  const handleSessionExpired = useCallback(() => {
    const addr = addressRef.current;
    if (!addr || isSigningRef.current) return;
    checkedAddressRef.current = null;
    setAuthStatus("loading");
    startAuthFlow(addr);
  }, []);

  // --- Context value ---
  const contextValue = useMemo<AuthContextValue>(
    () => ({
      status: authStatus,
      isAuthenticated: authStatus === "authenticated",
      handleSessionExpired,
    }),
    [authStatus, handleSessionExpired]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      <RainbowKitProvider theme={darkTheme()} initialChain={202555}>
        {children}
      </RainbowKitProvider>
    </AuthContext.Provider>
  );
}
