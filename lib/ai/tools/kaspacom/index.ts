import { kaspacomSwapTools } from "./swap";

// Tools the AI can call directly (quote tool hidden — compareSwapQuotes handles it)
export const kaspacomTools = {
  kaspacom_prepareSwap: kaspacomSwapTools.kaspacom_prepareSwap,
};

// Internal-only tools
export const kaspacomInternalTools = {
  kaspacom_getSwapQuote: kaspacomSwapTools.kaspacom_getSwapQuote,
};
