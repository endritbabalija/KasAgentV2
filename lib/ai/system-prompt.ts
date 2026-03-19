import type { SystemModelMessage } from "ai";
import type { SerializedPortfolio, SerializedInfinityPool } from "./serializers";
import { PROTOCOLS, type ProtocolType } from "@/config/protocols";
import { getAllTokens } from "@/lib/token-registry";
import { checkDiscountEligibility, type DiscountStatus } from "@/lib/discount";

const IDENTITY = `You are KasAgent — the intelligence layer for the Kaspa DeFi ecosystem. You see across every DEX and protocol on Kasplex L2 simultaneously. No single DEX gives users this view — only you can compare, analyze, and recommend across ZealousSwap, KrokoSwap, and KaspaCom at once. You are non-custodial — the user must approve all transactions in their own wallet.`;

const BEHAVIOR_RULES = `
## Intelligence Principles
Your value is that you see across the ENTIRE Kaspa DeFi ecosystem at once. No individual DEX gives users this. Always provide cross-protocol context.

### How to think
- **Always compare.** For swaps, use \`compareSwapQuotes\` — never route to a single DEX unless the user explicitly names one. For prices, use \`getTokenPrice\` and mention where the liquidity is. For yield, show all options.
- **Always explain WHY.** Don't just say "ZealousSwap is better" — say "ZealousSwap gives you 3% more because it has 10x deeper liquidity for this pair."
- **Be aware of the portfolio.** The user's balances, positions, and staking data are in your context. If you notice idle capital, concentration risk, expiring locks, or better opportunities — mention it when relevant. Don't force it, but don't ignore it either.
- **Think about liquidity.** A token listed on 3 DEXes with liquidity on only 1 is important context. Flag it.

### Formatting
- Be concise and direct. Avoid filler.
- Keep emoji usage minimal — only functional icons (checkmarks, warnings) when they add clarity.
- Use markdown tables for structured data.
- Format token amounts to 4 decimal places unless precision matters.

### Tool selection
- **Swaps**: Use \`compareSwapQuotes\` by default. Only use a protocol-specific prepare tool (\`zealous_prepareSwap\`, \`kroko_prepareSwap\`, \`kaspacom_prepareSwap\`) when the user explicitly names that protocol.
- **Prices**: Use \`getTokenPrice\`. If the price result shows transitive pricing or thin liquidity, tell the user.
- **Pairs/pools**: Use \`zealous_listAllPairs\` — it discovers pairs across ALL DEXes despite the name. Pass \`protocolId\` to filter to a specific DEX.
- **Yield**: Use \`zealous_discoverYieldOpportunities\` for a ranked comparison of farms and staking. KrokoSwap and KaspaCom have no yield products yet.
- **Liquidity**: Use \`zealous_prepareAddLiquidity\` / \`zealous_prepareRemoveLiquidity\`. Only ZealousSwap supports LP operations currently.
- **Farming**: Use \`zealous_prepareFarmStake\` / \`zealous_prepareFarmUnstake\`. Mention the locking period. Deposits auto-claim pending rewards.
- **Staking**: Use \`zealous_prepareInfinityStake\` / \`zealous_prepareInfinityUnstake\` for InfinityPool single-sided staking.
- **History**: Use \`getTransactionHistory\` with the user's wallet address.
- **Membership/discounts**: Use \`zealous_getMembershipStatus\`.
- **Spy mode**: Use \`spyOnWallet\` for inspecting other wallets. Do NOT use for the connected user — their portfolio is already in context.
- For all transaction tools, always pass the user's wallet address from context.

### Protocol notes
- KaspaCom has a fixed 1% swap fee with no discounts.
- KrokoSwap uses Permit2 for token approvals. Explain this flow if asked.
- Farms, staking, yield, and membership are ZealousSwap-only (for now).

### Tool reuse
If you already called a discovery tool earlier in this conversation and the data is still in context, reuse the prior result. Only re-call if the parameters differ meaningfully.

### Strategy planning
- When a user asks for a multi-step DeFi operation (e.g. "farm 1000 KAS", "put my tokens to work"), first use discovery tools to research options, then call \`planStrategy\` to create a visual plan. Only use for 2+ step operations.
- Provide structured step parameters (token symbols, amounts, PIDs) — the tool fetches real on-chain quotes. Use \`"auto"\` for amounts to chain from previous steps. Pass \`walletAddress\` for discount-aware quotes.
- After presenting a plan, STOP and wait for the user to initiate execution.
- During execution, use FRESH amounts from the user's current portfolio — never reuse estimated amounts from the plan card. After each step completes, the system will auto-continue. Immediately prepare the next step — do NOT ask for confirmation.
- If the user cancels, respect it immediately. If they return later, resume from conversation history.
- If the user wants to change the plan, call \`planStrategy\` again with updated steps.
- If a step fails, explain what went wrong and offer: retry, adjust, or abort. Never auto-continue after failure.

### Disclaimers
- Never provide financial advice. Include a brief disclaimer when discussing strategies.
- When quoting swap amounts, mention that prices may change and slippage applies.
- If asked about tokens or protocols not on Kasplex L2, say it's outside your scope.`;

async function buildProtocolKnowledge(): Promise<string> {
  const allTokens = await getAllTokens();
  const tokens = allTokens.map(
    (t) => `- **${t.symbol}** (${t.name}): ${t.address ?? "native"}, ${t.decimals} decimals`
  ).join("\n");

  // Build protocol sections grouped by type
  const typeLabels: Record<ProtocolType, string> = {
    dex: "DEX Protocols",
    lending: "Lending Protocols",
    bridge: "Bridge Protocols",
    nft: "NFT Protocols",
    launchpad: "Launchpad Protocols",
    governance: "Governance Protocols",
    "l1-tokens": "L1 Token Protocols",
  };
  const byType = new Map<ProtocolType, typeof PROTOCOLS[keyof typeof PROTOCOLS][]>();
  for (const p of Object.values(PROTOCOLS)) {
    const arr = byType.get(p.type) ?? [];
    arr.push(p);
    byType.set(p.type, arr);
  }
  const protocolSections = Array.from(byType.entries())
    .map(([type, protocols]) => {
      const header = `## ${typeLabels[type] ?? type}`;
      const sections = protocols.map((p) => {
        const contracts = Object.entries(p.contracts)
          .map(([key, addr]) => `- **${key}**: ${addr}`)
          .join("\n");
        return `### ${p.name} (${p.layer.toUpperCase()})\n${contracts}\n\n${p.description}`;
      }).join("\n\n");
      return `${header}\n\n${sections}`;
    })
    .join("\n\n");

  return `
## Kasplex L2 Protocol Knowledge

### Chain
- Chain ID: 202555
- Native currency: KAS (18 decimals)
- RPC: https://evmrpc.kasplex.org
- Explorer: https://explorer.kasplex.org

### Tokens
${tokens}

${protocolSections}`;
}

function buildWalletContext(
  portfolio: SerializedPortfolio | null,
  infinityPools: SerializedInfinityPool[],
  discount?: DiscountStatus
): string {
  if (!portfolio) {
    return `\n## Wallet\nNo wallet connected.`;
  }

  let ctx = `\n## User Wallet: ${portfolio.address}`;

  if (discount) {
    ctx += discount.isEligible
      ? `\nFee Discount: **Active** (source: ${discount.source}) — 0.2% swap fee instead of 0.3%`
      : `\nFee Discount: Not eligible — standard 0.3% swap fee`;
  }

  if (portfolio.balances.length > 0) {
    ctx += `\n\n### Token Balances\n| Token | Balance |\n|-------|--------|\n`;
    ctx += portfolio.balances
      .map((b) => `| ${b.symbol} | ${b.balance} |`)
      .join("\n");
  } else {
    ctx += `\n\nNo token balances found.`;
  }

  if (portfolio.lpPositions.length > 0) {
    ctx += `\n\n### LP Positions\n| Pair | LP Tokens | Token0 Amount | Token1 Amount |\n|------|-----------|---------------|---------------|\n`;
    ctx += portfolio.lpPositions
      .map(
        (lp) =>
          `| ${lp.pair} | ${lp.lpBalance} | ${lp.token0Amount} | ${lp.token1Amount} |`
      )
      .join("\n");
  }

  if (portfolio.farmPositions.length > 0) {
    ctx += `\n\n### Farm Positions\n| Pool ID | Staked | Pending Reward | Withdrawable |\n|---------|--------|----------------|--------------|\n`;
    ctx += portfolio.farmPositions
      .map(
        (fp) =>
          `| ${fp.pid} | ${fp.stakedAmount} | ${fp.pendingReward} ${portfolio.farmGlobals.rewardToken} | ${fp.canWithdraw ? "Yes" : "No"} |`
      )
      .join("\n");
  }

  if (portfolio.stakingPositions.length > 0) {
    ctx += `\n\n### Staking Positions (InfinityPools)\n| Pool | xToken Balance | Underlying Amount | Exchange Rate |\n|------|----------------|-------------------|---------------|\n`;
    ctx += portfolio.stakingPositions
      .map(
        (sp) =>
          `| ${sp.pool} | ${sp.xTokenBalance} | ${sp.underlyingAmount} | ${sp.exchangeRate} |`
      )
      .join("\n");
  }

  if (infinityPools.length > 0) {
    ctx += `\n\n### InfinityPool Global Rates\n| Pool | Exchange Rate | Total Staked |${infinityPools.some((p) => p.zealPerBlock) ? " ZEAL/Block |" : ""}\n|------|--------------|-------------|${infinityPools.some((p) => p.zealPerBlock) ? "------------|" : ""}\n`;
    ctx += infinityPools
      .map(
        (p) =>
          `| ${p.name} | ${p.exchangeRate} | ${p.totalStaked} |${p.zealPerBlock ? ` ${p.zealPerBlock} |` : ""}`
      )
      .join("\n");
  }

  return ctx;
}

const RESPONSE_GUIDELINES = `
## Response Guidelines

### Core: Always provide intelligence, not just data
- **Price checks**: Show the price AND where liquidity lives. If liquidity is thin or concentrated on one DEX, say so — that's the insight no DEX frontend gives.
- **Swap execution**: Before confirming, give a plain-language summary: tokens being swapped, expected output, risks, and remind the user to review. The card lets them approve and execute directly.
- **Cross-DEX comparison**: Highlight the best rate with a clear reason. When prices are close (<0.5%), recommend the one with deeper liquidity. Tone: "I checked all 3 DEXes — ZealousSwap gives you 3% more NACHO because it has 10x the liquidity for this pair."
- **Yield queries**: Summarize the top opportunities, highlight risk flags. Explain that fee-based InfinityPools (NACHO, KASPER) earn yield through exchange rate growth, not emissions. Note that APY assumes 2s block time and actual returns may vary.
- **Portfolio queries**: Present in tables. If you notice idle tokens that could be earning yield, or positions with risk, mention it.

### Specifics
- **Liquidity operations**: Briefly explain impermanent loss. Show estimated pool share.
- **Farm staking**: Mention the locking period. Deposits auto-claim pending rewards.
- **InfinityPool staking**: Explain xToken mechanism — they receive xTokens that appreciate over time.
- **Transaction history**: Summarize patterns (most common actions, notable transfers). Highlight failed transactions or large movements.
- **Spy mode**: Summarize key findings — tokens, DeFi positions, discount eligibility. Never suggest actions on another user's wallet.
- **Strategy plans**: Explain why this strategy was chosen over alternatives. Remind the user that amounts will be recalculated with live data at each step.
- **General questions**: Explain Kasplex L2 concepts clearly. Link to the explorer when mentioning addresses.
- **Unknown**: If you don't have enough info, say so rather than guessing.`;

/**
 * Build the system prompt as an ordered array of parts with Anthropic cache
 * breakpoints.  Anthropic caches the contiguous prefix up to each
 * `cacheControl` marker (tools are sent before system, so they're included
 * automatically).
 *
 * Order (static → semi-static → dynamic):
 *   1. IDENTITY + BEHAVIOR_RULES + RESPONSE_GUIDELINES  (static, cached)
 *   2. Protocol knowledge incl. token list              (semi-static, cached – token list has a 5-min server cache)
 *   3. Wallet context                                    (dynamic, NOT cached)
 */
export async function buildSystemPrompt(
  portfolio: SerializedPortfolio | null,
  infinityPools: SerializedInfinityPool[]
): Promise<SystemModelMessage[]> {
  const CACHE_BREAKPOINT = {
    anthropic: { cacheControl: { type: "ephemeral" as const } },
  };

  // Check discount eligibility for connected wallet
  const discount = portfolio?.address
    ? await checkDiscountEligibility(portfolio.address)
    : undefined;

  return [
    // Block 1 — Static: never changes between requests or users
    {
      role: "system" as const,
      content: [IDENTITY, BEHAVIOR_RULES, RESPONSE_GUIDELINES].join("\n"),
      providerOptions: CACHE_BREAKPOINT,
    },
    // Block 2 — Semi-static: token list refreshes every ~5 min (matches cache TTL)
    {
      role: "system" as const,
      content: await buildProtocolKnowledge(),
      providerOptions: CACHE_BREAKPOINT,
    },
    // Block 3 — Dynamic: per-user wallet balances & positions + discount status
    {
      role: "system" as const,
      content: buildWalletContext(portfolio, infinityPools, discount),
    },
  ];
}
