export interface QuickAction {
  label: string;
  message: string;
  variant?: "primary" | "secondary";
}

const ACTION_TOOLS = new Set([
  "zealous_prepareSwap",
  "kroko_prepareSwap",
  "kaspacom_prepareSwap",
  "executeSwap",
  "zealous_prepareAddLiquidity",
  "executeAddLiquidity",
  "zealous_prepareRemoveLiquidity",
  "executeRemoveLiquidity",
  "zealous_prepareFarmStake",
  "executeFarmDeposit",
  "zealous_prepareFarmUnstake",
  "executeFarmWithdraw",
  "zealous_prepareInfinityStake",
  "executeStake",
  "zealous_prepareInfinityUnstake",
  "executeUnstake",
]);

export function getQuickActions(
  toolName: string,
  output: unknown
): QuickAction[] {
  if (ACTION_TOOLS.has(toolName)) return [];

  const out = output as Record<string, unknown> | undefined;

  switch (toolName) {
    case "zealous_getSwapQuote": {
      const tokenOut = (out?.tokenOut as string) ?? "";
      return [
        {
          label: `Stake ${tokenOut || "tokens"}`,
          message: `Check staking rates for ${tokenOut || "the output token"}`,
          variant: "primary",
        },
        { label: "Find better rate", message: "Find a better swap rate", variant: "secondary" },
      ];
    }
    case "zealous_getPoolReserves":
      return [
        {
          label: "Check farms",
          message: "Check farms for this pair",
          variant: "primary",
        },
      ];
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
    case "zealous_getActiveFarms":
      return [
        {
          label: "Compare staking",
          message: "Compare with staking yields",
          variant: "secondary",
        },
      ];
    case "zealous_getInfinityPoolRates":
      return [
        {
          label: "Best yield",
          message: "What's the best yield opportunity right now?",
          variant: "primary",
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
    case "kroko_getSwapQuote": {
      const tokenOut = (out?.tokenOut as string) ?? "";
      return [
        {
          label: "Compare rates",
          message: `Compare swap rates across DEXes for ${tokenOut || "this token"}`,
          variant: "primary",
        },
      ];
    }
    case "compareSwapQuotes": {
      return [
        {
          label: "Execute best",
          message: "Swap on the recommended DEX",
          variant: "primary",
        },
      ];
    }
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
    default:
      return [];
  }
}
