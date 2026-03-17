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
import { useAccount } from "wagmi";
import { SiweMessage } from "siwe";
import {
  createAuthenticationAdapter,
  RainbowKitAuthenticationProvider,
  RainbowKitProvider,
  darkTheme,
  type AuthenticationStatus,
} from "@rainbow-me/rainbowkit";

// --- AuthContext: exposed to the rest of the app ---

interface AuthContextValue {
  status: AuthenticationStatus;
  isAuthenticated: boolean;
  handleSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue>(null!);

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// --- AuthProvider: wraps RainbowKitAuthenticationProvider + RainbowKitProvider ---

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address, isReconnecting } = useAccount();
  const [authStatus, setAuthStatus] =
    useState<AuthenticationStatus>("loading");

  // Ref for getNonce(): captures current address since RainbowKit's
  // getNonce takes no arguments, but our nonce endpoint needs the address
  const addressRef = useRef(address);
  useLayoutEffect(() => { addressRef.current = address; });

  // --- One-time session check on mount ---
  // hasCheckedSession is only set to true when we actually check with an address,
  // NOT when we see !address (which could be the hydration gap before wagmi reconnects)
  const hasCheckedSession = useRef(false);

  useEffect(() => {
    // During reconnection, stay in loading state and wait
    if (isReconnecting) return;
    if (hasCheckedSession.current) return;

    if (!address) {
      // No wallet connected (cookieStorage ensures address is immediately
      // available if a wallet was previously connected — no hydration gap)
      hasCheckedSession.current = true;
      setAuthStatus("unauthenticated");
      return;
    }

    // Wallet connected — check session immediately
    hasCheckedSession.current = true;

    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          setAuthStatus("unauthenticated");
          return;
        }
        const data = await res.json();
        // Cookie wallet must match connected wallet
        if (data.wallet?.toLowerCase() === address.toLowerCase()) {
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("unauthenticated");
        }
      })
      .catch(() => setAuthStatus("unauthenticated"));
  }, [isReconnecting, address]);

  // --- 401 handler: sets status so RainbowKit shows sign-in modal ---
  const handleSessionExpired = useCallback(() => {
    setAuthStatus("unauthenticated");
  }, []);

  // --- SIWE Authentication Adapter ---
  /* eslint-disable react-hooks/refs -- addressRef is only read in callbacks (getNonce), never during render */
  const adapter = useMemo(
    () =>
      createAuthenticationAdapter({
        getNonce: async () => {
          const currentAddress = addressRef.current;
          if (!currentAddress) throw new Error("No wallet connected");

          const res = await fetch("/api/auth/nonce", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: currentAddress }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to get nonce");
          }
          const { nonce } = await res.json();
          return nonce;
        },

        createMessage: ({ nonce, address: addr, chainId }) => {
          return new SiweMessage({
            domain: window.location.host,
            address: addr,
            statement: "Sign in to KasAgent",
            uri: window.location.origin,
            version: "1",
            chainId,
            nonce,
          }).prepareMessage();
        },

        verify: async ({ message, signature }) => {
          const res = await fetch("/api/auth/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, signature }),
          });
          if (res.ok) {
            setAuthStatus("authenticated");
            return true;
          }
          return false;
        },

        signOut: async () => {
          await fetch("/api/auth/signout", { method: "POST" }).catch(
            () => {}
          );
          setAuthStatus("unauthenticated");
        },
      }),
    [] // Stable — uses refs for mutable data, setAuthStatus is stable
  );
  /* eslint-enable react-hooks/refs */

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
      <RainbowKitAuthenticationProvider adapter={adapter} status={authStatus}>
        <RainbowKitProvider theme={darkTheme()} initialChain={202555}>
          {children}
        </RainbowKitProvider>
      </RainbowKitAuthenticationProvider>
    </AuthContext.Provider>
  );
}
