"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useAppContext } from "./AppContext";
import { PortfolioPanel } from "@/components/sidebar/PortfolioPanel";

export function PortfolioSlideOut() {
  const { portfolio, pools, portfolioPanel } = useAppContext();

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (!portfolioPanel.isOpen) return;
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [portfolioPanel.isOpen]);

  return (
    <>
      {/* Backdrop (mobile + desktop) */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          portfolioPanel.isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={portfolioPanel.close}
        aria-label="Close portfolio"
      />

      {/* Slide-out panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-80 z-50 bg-zinc-950 border-l border-zinc-800 transition-transform duration-300 ${
          portfolioPanel.isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-200">Portfolio</h2>
          <button
            onClick={portfolioPanel.close}
            className="p-1 rounded hover:bg-zinc-800 transition-colors"
            aria-label="Close portfolio"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-49px)] px-4 py-3">
          <PortfolioPanel portfolio={portfolio} pools={pools} />
        </div>
      </aside>
    </>
  );
}
