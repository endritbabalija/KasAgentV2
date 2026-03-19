import { useEffect } from "react";

/**
 * Runs an effect exactly once on mount (and cleanup on unmount).
 * Wrapper around useEffect(..., []) that makes intent explicit
 * and prevents ad-hoc effect usage in components.
 */
export function useMountEffect(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
