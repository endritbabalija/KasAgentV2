"use client";

import { create } from "zustand";

interface PanelState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

interface UIState {
  portfolioPanel: PanelState;
  leftRail: PanelState;
}

export const useUIStore = create<UIState>((set) => ({
  portfolioPanel: {
    isOpen: false,
    toggle: () =>
      set((s) => ({
        portfolioPanel: { ...s.portfolioPanel, isOpen: !s.portfolioPanel.isOpen },
      })),
    close: () =>
      set((s) => ({
        portfolioPanel: { ...s.portfolioPanel, isOpen: false },
      })),
  },
  leftRail: {
    isOpen: false,
    toggle: () =>
      set((s) => ({
        leftRail: { ...s.leftRail, isOpen: !s.leftRail.isOpen },
      })),
    close: () =>
      set((s) => ({
        leftRail: { ...s.leftRail, isOpen: false },
      })),
  },
}));

export const usePortfolioPanel = () => useUIStore((s) => s.portfolioPanel);
export const useLeftRail = () => useUIStore((s) => s.leftRail);
export const useAnyPanelOpen = () =>
  useUIStore((s) => s.portfolioPanel.isOpen || s.leftRail.isOpen);
