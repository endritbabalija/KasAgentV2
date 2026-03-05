"use client";

import { useState, useCallback, useEffect } from "react";

export function useSidebarState() {
  const [isOpen, setIsOpen] = useState(false);

  // Set initial state based on screen width (open on md+, closed on mobile)
  useEffect(() => {
    setIsOpen(window.innerWidth >= 768);
  }, []);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, toggle, open, close };
}
