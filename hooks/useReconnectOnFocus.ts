"use client";

import { useEffect } from "react";
import { useReconnect } from "wagmi";

/**
 * Reconnects wagmi connectors when the tab becomes visible again.
 * Fixes mobile Safari dropping WalletConnect WebSocket when backgrounded.
 */
export function useReconnectOnFocus() {
  const { reconnect } = useReconnect();

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reconnect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [reconnect]);
}
