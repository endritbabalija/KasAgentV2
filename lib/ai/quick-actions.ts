export interface QuickAction {
  label: string;
  message: string;
  variant?: "primary" | "secondary";
}

// Execution tools — cards have their own Execute buttons, no quick actions needed
const ACTION_TOOLS = new Set([
  "zealous_prepareSwap",
  "kroko_prepareSwap",
  "kaspacom_prepareSwap",
  "zealous_prepareAddLiquidity",
  "zealous_prepareRemoveLiquidity",
  "zealous_prepareFarmStake",
  "zealous_prepareFarmUnstake",
  "zealous_prepareInfinityStake",
  "zealous_prepareInfinityUnstake",
]);

export function getQuickActions(
  toolName: string,
  output: unknown
): QuickAction[] {
  if (ACTION_TOOLS.has(toolName)) return [];

  const out = output as Record<string, unknown> | undefined;

  switch (toolName) {
    case "zealous_listAllPairs":
      return [
        {
          label: "Best yield",
          message: "Which pool has the best yield?",
          variant: "primary",
        },
        {
          label: "Add liquidity",
          message: "I want to add liquidity",
          variant: "secondary",
        },
      ];
    case "zealous_discoverYieldOpportunities":
      return [
        {
          label: "Show top option",
          message: "Show me the top option in detail",
          variant: "primary",
        },
      ];
    case "compareSwapQuotes": {
      return [
        {
          label: "Execute best",
          message: "Swap on the recommended DEX",
          variant: "primary",
        },
      ];
    }
    case "getTokenPrice":
      return [
        {
          label: "Swap this token",
          message: "I want to swap this token",
          variant: "primary",
        },
        {
          label: "Check yield",
          message: "Are there yield opportunities for this token?",
          variant: "secondary",
        },
      ];
    case "planStrategy": {
      const steps = (out?.steps as Array<{ action?: string }>) ?? [];
      const firstAction = steps[0]?.action ?? "step 1";
      return [
        {
          label: `Start: ${firstAction.length > 30 ? firstAction.slice(0, 30) + "…" : firstAction}`,
          message: `Let's start the strategy. Execute step 1: ${firstAction}`,
          variant: "primary",
        },
        {
          label: "Modify plan",
          message: "I'd like to modify this strategy plan",
          variant: "secondary",
        },
      ];
    }
    case "spyOnWallet":
      return [
        {
          label: "Check my portfolio",
          message: "How does my portfolio compare?",
          variant: "primary",
        },
      ];
    case "getTransactionHistory":
      return [
        {
          label: "Check portfolio",
          message: "What's my current portfolio?",
          variant: "primary",
        },
        {
          label: "Find yield",
          message: "What are the best yield opportunities?",
          variant: "secondary",
        },
      ];
    case "zealous_getMembershipStatus":
      return [
        {
          label: "Check savings",
          message: "How much am I saving on swap fees?",
          variant: "primary",
        },
      ];
    default:
      return [];
  }
}
