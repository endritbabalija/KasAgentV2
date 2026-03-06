export interface QuickAction {
  label: string;
  message: string;
}

const ACTION_TOOLS = new Set([
  "prepareSwap",
  "executeSwap",
  "prepareAddLiquidity",
  "executeAddLiquidity",
  "prepareRemoveLiquidity",
  "executeRemoveLiquidity",
  "prepareFarmDeposit",
  "executeFarmDeposit",
  "prepareFarmWithdraw",
  "executeFarmWithdraw",
  "prepareStake",
  "executeStake",
  "prepareUnstake",
  "executeUnstake",
]);

export function getQuickActions(
  toolName: string,
  output: unknown
): QuickAction[] {
  if (ACTION_TOOLS.has(toolName)) return [];

  const out = output as Record<string, unknown> | undefined;

  switch (toolName) {
    case "getSwapQuote": {
      const tokenOut = (out?.tokenOut as string) ?? "";
      return [
        {
          label: `Stake ${tokenOut || "tokens"}`,
          message: `Check staking rates for ${tokenOut || "the output token"}`,
        },
        { label: "Find better rate", message: "Find a better swap rate" },
      ];
    }
    case "getPoolReserves":
      return [
        {
          label: "Check farms",
          message: "Check farms for this pair",
        },
      ];
    case "getActiveFarms":
      return [
        {
          label: "Compare staking",
          message: "Compare with staking yields",
        },
      ];
    case "getInfinityPoolRates":
      return [
        {
          label: "Best yield",
          message: "What's the best yield opportunity right now?",
        },
      ];
    case "discoverYieldOpportunities":
      return [
        {
          label: "Show top option",
          message: "Show me the top option in detail",
        },
      ];
    case "getTransactionHistory":
      return [
        {
          label: "Check portfolio",
          message: "What's my current portfolio?",
        },
        {
          label: "Find yield",
          message: "What are the best yield opportunities?",
        },
      ];
    default:
      return [];
  }
}
