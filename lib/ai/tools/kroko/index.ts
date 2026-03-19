import { krokoSwapTools } from "./swap";

// Tools the AI can call directly (quote tool hidden — compareSwapQuotes handles it)
export const krokoTools = {
  kroko_prepareSwap: krokoSwapTools.kroko_prepareSwap,
};

// Internal-only tools
export const krokoInternalTools = {
  kroko_getSwapQuote: krokoSwapTools.kroko_getSwapQuote,
};
