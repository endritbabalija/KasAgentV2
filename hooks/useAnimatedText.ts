"use client";

import { useEffect, useRef, useState } from "react";

const CHAR_INTERVAL_MS = 12;

/**
 * Smoothly reveals streamed text character-by-character using requestAnimationFrame.
 * New characters are animated in at ~12ms intervals, batching if behind.
 * Returns the full text immediately once streaming is complete (component unmounts).
 */
export function useAnimatedText(targetText: string): string {
  const [displayedText, setDisplayedText] = useState("");
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(-1);
  const indexRef = useRef(0);

  useEffect(() => {
    const animate = (time: number) => {
      // Initialize timing on first frame to avoid dumping all chars at once
      if (lastTimeRef.current < 0) {
        lastTimeRef.current = time;
      }

      if (indexRef.current >= targetText.length) return;

      const elapsed = time - lastTimeRef.current;
      if (elapsed >= CHAR_INTERVAL_MS) {
        const charsToReveal = Math.min(
          Math.max(1, Math.floor(elapsed / CHAR_INTERVAL_MS)),
          targetText.length - indexRef.current
        );
        indexRef.current += charsToReveal;
        setDisplayedText(targetText.slice(0, indexRef.current));
        lastTimeRef.current = time;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetText]);

  return displayedText;
}
