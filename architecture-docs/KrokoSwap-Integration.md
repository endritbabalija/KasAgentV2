# KasAgent × KrokoSwap Integration

**Protocol:** KrokoSwap DEX (V2 + V3)
**Chain:** Kasplex L2 Mainnet (Chain ID: 202555)
**Status:** Live on Mainnet
**Date:** March 2026
**Companion docs:** KasAgent-Multi-Protocol-UX-Spec.md, architecture-map.md, single-protocol-coupling-audit.md, multiprotocol-readiness.md

---

## 1. Executive Summary

KrokoSwap is a dual-AMM decentralized exchange deployed on Kasplex L2 mainnet, combining V2 constant-product pools with V3 concentrated-liquidity pools under a Universal Router. It provides a public REST API for swap routing, quoting, and calldata generation, making it an ideal second protocol integration for KasAgent.

This is KasAgent's first multi-protocol integration. It requires both architectural prep work (making the codebase multi-protocol ready) and protocol-specific implementation (KrokoSwap tools, cards, and API integration). The UX follows the "Smart Default + Compare" pattern defined in the UX spec — the AI checks both DEXes, recommends the best option with a reason, and lets the user compare or override.

This document captures all technical details needed: contract addresses, API endpoints, swap flow mechanics, architectural differences from ZealousSwap, prerequisites, and a phased implementation plan.

---

## 2. Protocol Overview

### 2.1 What KrokoSwap Is

KrokoSwap is a DEX on Kasplex L2 that supports two AMM models through a single routing layer:

- **V2 Pools** — Constant-product AMM (x × y = k). Simple, gas-efficient, full-range liquidity. Fixed 0.3% fee. Fungible ERC-20 LP tokens.
- **V3 Pools** — Concentrated liquidity AMM. LPs choose a custom price range for up to 4000x capital efficiency. Selectable fee tiers (0.01%, 0.05%, 0.3%, 1%). Non-fungible ERC-721 position NFTs.
- **Universal Router** — Single entry point for executing swaps across both V2 and V3 in one transaction. Handles multi-hop and split routes automatically.
- **Permit2** — Token approval manager. Users approve tokens once to Permit2, then grant per-spender permissions with expiration control. Replaces the traditional unlimited-approval pattern.
- **Swap API** — Off-chain routing engine that finds optimal paths across V2/V3 pools and generates ready-to-use transaction calldata. No authentication required.

### 2.2 How a Swap Works

KrokoSwap uses a 5-step swap flow:

1. **Approve** — User approves their input token to the Permit2 contract (one-time per token)
2. **Permit** — User grants the Universal Router permission via Permit2 (one-time per token)
3. **Quote** — Frontend requests an optimal route from the Swap API (`GET /api/v1/quote`)
4. **Calldata** — Frontend requests encoded transaction data from the Swap API (`POST /api/v1/swap`)
5. **Execute** — User sends the transaction to the Universal Router via their wallet

The routing engine automatically selects the best path — single-hop or multi-hop, V2 or V3 or mixed — based on available liquidity and price impact.

### 2.3 V2 vs V3 Comparison

| Feature | V2 | V3 |
|---|---|---|
| Liquidity Range | Full range (0 to ∞) | Custom price range |
| Fee | Fixed 0.3% | 0.01%, 0.05%, 0.3%, 1% |
| LP Token | Fungible ERC-20 | Non-fungible ERC-721 |
| Capital Efficiency | Lower | Up to 4000x for narrow ranges |
| Complexity | Simple | Advanced |
| Best For | Stable pairs, passive LPs | Active LPs seeking higher returns |

### 2.4 Native Token Handling

Kasplex's native currency is KAS (18 decimals). Since AMM contracts require ERC-20 tokens, KAS is wrapped as WKAS for on-chain operations. The WKAS address is `0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e` — the same address used by ZealousSwap. The Universal Router handles wrapping and unwrapping automatically, so users interact with native KAS directly.

---

## 3. Contract Addresses

### 3.1 Kasplex Mainnet (Chain ID: 202555)

| Contract | Address | Role |
|---|---|---|
| **Permit2** | `0x2E1987F680FD7Bc8B33d3Bf94f12B988A0B50034` | Token approval manager |
| **Universal Router** | `0xefeCc1c2dE3BfE4C6D43030F2AcDD5C3cE279024` | Unified swap execution |
| **WKAS** | `0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e` | Wrapped KAS (ERC-20) |
| **V2 Factory** | `0x4373b7Fcf5059A785843cD224129e01d243Aef71` | Creates V2 pairs |
| **V2 Router** | `0xC7ca845B8302346e1C7227f03bb9EFb35ecD51fe` | V2 liquidity ops |
| **V3 Factory** | `0x0dfb1Bb755d872EA1fa4d95E4ad0c2E6317Ce9B9` | Creates V3 pools |
| **V3 Position Manager** | `0x343b244bEDF133D57C61b241557bF29AA32ea4F9` | V3 position NFTs |
| **V3 Router** | `0x1F896179244C2675b6a1F36376cDF3B125d72B63` | V3 swap routing |
| **V3 QuoterV2** | `0xC3D66b70F3BA12c1D1Ec5A20b0feB855b147812e` | On-chain quote estimation |

Network configuration:

```json
{
  "chainId": 202555,
  "chainName": "Kasplex Mainnet",
  "rpcUrl": "https://evmrpc.kasplex.org",
  "blockExplorer": "https://explorer.kasplex.org",
  "nativeCurrency": {
    "name": "KAS",
    "symbol": "KAS",
    "decimals": 18
  }
}
```

### 3.2 Kasplex Testnet (Chain ID: 167012)

| Contract | Address | Role |
|---|---|---|
| **Permit2** | `0xc320bc492Bb56169aBE18D3C0a2048c45febC897` | Token approval manager |
| **Universal Router** | `0x440d7f5FE865eFCcfdCB1ee9a000C114163689ba` | Unified swap execution |
| **WKAS** | `0xC065C62a10fB363fD31CA394D632C4Df106566df` | Wrapped KAS (ERC-20) |
| **V2 Factory** | `0x497152FfC1FEa1Ff31cc7cEeca4f4b9495b606fB` | Creates V2 pairs |
| **V2 Router** | `0xf2ece243a0EFC0Cd1fcd3386b2f73f16D1378689` | V2 liquidity ops |
| **V3 Factory** | `0x6ea7b69cDB0Af4DE7DF60DA08edE2F7E2b8d5924` | Creates V3 pools |
| **V3 Position Manager** | `0xDAF3700A7D80B26d5DD971C3C0e2fB93Ad73219f` | V3 position NFTs |
| **V3 Router** | `0xe3DC728050962343922A8E7b3E0cC158C94A1448` | V3 swap routing |
| **V3 QuoterV2** | `0xfd0e09944444338Ab33b5b5eF66cd741331121e0` | On-chain quote estimation |

### 3.3 Key Observation: Shared WKAS

The WKAS contract address on mainnet (`0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e`) is identical to the one ZealousSwap uses. This means KasAgent's existing token registry already knows about WKAS. No special handling is needed for the wrapped native token when integrating KrokoSwap.

---

## 4. API Specification

### 4.1 Base URLs

| Network | Base URL |
|---|---|
| Mainnet | `https://krokoswap.io/swap-api` |
| Testnet | `https://testnet.krokoswap.io/swap-api` |

> **Note (2026-03-13):** The original docs referenced `https://dex.kasplex.org/swap-api` but that domain does not resolve. The correct mainnet API is at `https://krokoswap.io/swap-api` (verified working).

No authentication required. No rate limits currently enforced.

### 4.2 Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/quote` | Get swap quote with optimal V2/V3 routing |
| `POST` | `/api/v1/swap` | Generate Universal Router calldata for execution |
| `GET` | `/api/v1/pools` | List available liquidity pools |
| `GET` | `/api/v1/tokens` | List known tokens |
| `GET` | `/api/v1/tokens2` | Extended token list with metadata |

### 4.3 Quote Endpoint

`GET /api/v1/quote` — Get optimal swap quote

Query parameters:

| Parameter | Type | Description |
|---|---|---|
| `tokenIn` | address | Input token address (use WKAS for native KAS) |
| `tokenOut` | address | Output token address |
| `amountIn` | string (wei) | Exact input amount in raw units (for tradeType 0) |
| `amountOut` | string (wei) | Exact output amount in raw units (for tradeType 1) |
| `tradeType` | 0 \| 1 | 0 = Exact Input, 1 = Exact Output |

Response includes: `amountIn`, `amountOut`, `executionPrice` (number), `priceImpact` (number, percentage), `gasCost`, `isSplit`, and a `route` **object** with fields `path` (address[]), `protocol` (string), `hops` (number), `fees` (number[]), `protocols` (string[]). Note: `route` is an object, not a string.

Example:

```
GET /api/v1/quote?tokenIn=0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e&tokenOut=0xB190a6A7fC2873f1Abf145279eD664348d5Ef630&amountIn=1000000000000000000&tradeType=0
```

### 4.4 Swap Endpoint

`POST /api/v1/swap` — Generate transaction calldata

Request body (JSON):

| Field | Type | Description |
|---|---|---|
| `tokenIn` | address | Input token address |
| `tokenOut` | address | Output token address |
| `amountIn` | string (wei) | Input amount (for tradeType 0) |
| `amountOut` | string (wei) | Output amount (for tradeType 1) |
| `tradeType` | 0 \| 1 | 0 = Exact Input, 1 = Exact Output |
| `slippage` | number | Slippage tolerance percentage (e.g. 0.5) |
| `recipient` | address | Wallet address to receive output tokens |
| `deadline` | string | Seconds until tx expires (e.g. "1200"). **Must be a string, not a number.** |

Response returns `to` (Universal Router address), `data` (encoded calldata), `value` (KAS value for native swaps), `gasEstimate`, and a nested `quote` object containing `amountIn`, `amountOut`, `minAmountOut`, `priceImpact`, `protocol`, `path`, `fees`, `hops`, `isSplit`.

### 4.5 Token Amounts

All token amounts in the API use raw units (wei). For a token with 18 decimals:

| Human Amount | Raw Amount |
|---|---|
| 1.0 | `1000000000000000000` |
| 0.5 | `500000000000000000` |
| 100 | `100000000000000000000` |

Convert with: `rawAmount = humanAmount × 10^decimals`

---

## 5. Architecture: KrokoSwap vs ZealousSwap

Understanding the architectural differences between these two protocols is critical for planning the integration cleanly.

| Aspect | ZealousSwap (Current) | KrokoSwap (New) |
|---|---|---|
| AMM Model | V2 only (Uniswap V2 fork) | V2 + V3 dual AMM |
| Swap Entry Point | V2 Router contract directly | Universal Router (single entry) |
| Approval Pattern | Direct ERC-20 approve to Router | Permit2 two-step approval |
| Quoting | On-chain via getAmountsOut | REST API (off-chain routing) |
| Routing | Manual WKAS hop in AI tools | API finds optimal path automatically |
| Calldata | Built in execution cards (viem) | API returns ready-to-send calldata |
| LP Positions | ERC-20 LP tokens + MasterChef | V2: ERC-20, V3: ERC-721 NFTs |
| Farms/Staking | MasterChef + InfinityPools | Not documented yet |
| Token Discovery | On-chain from Factory pairs | API /tokens endpoint + on-chain |

### 5.1 Key Architectural Difference: API-First

The most significant difference is that KrokoSwap provides a public REST API that handles routing, quoting, and calldata generation. With ZealousSwap, KasAgent's AI tools do all the on-chain quoting and path-finding manually via viem reads. With KrokoSwap, the AI tool calls the API, shows the quote in a card, then the execution card sends the pre-built calldata to the Universal Router.

This means KasAgent's server-side tool modules for KrokoSwap will be significantly thinner than the ZealousSwap equivalents. The complexity shifts from on-chain read logic to HTTP API calls.

### 5.2 Permit2 Approval Flow

ZealousSwap uses the traditional ERC-20 approval model: approve the Router to spend your tokens, then the Router transfers them during the swap. KrokoSwap uses Permit2, which adds an intermediary layer:

1. User approves tokens to the Permit2 contract (one-time, typically max uint256)
2. User calls `Permit2.approve()` to grant the Universal Router a specific allowance with expiration
3. Universal Router uses Permit2 to pull tokens during swap execution

Execution cards need to check both layers: the ERC-20 allowance to Permit2 AND the Permit2 allowance to the Universal Router. If either is insufficient, prompt the appropriate approval transaction before executing.

---

## 6. UX Pattern: Smart Default + Compare

> Full spec: KasAgent-Multi-Protocol-UX-Spec.md

This integration follows the "Smart Default + Compare" UX pattern. This section summarizes how it applies specifically to the KrokoSwap integration.

### 6.1 Core Behavior

When a user requests a swap, yield info, or liquidity action:

1. The AI queries **all integrated protocols** (ZealousSwap + KrokoSwap) in parallel
2. It picks the **best option** based on the action type (best price, best yield, lowest risk)
3. It shows **one recommended option** prominently with a clear reason
4. A **"Compare" toggle** expands to show alternatives from other protocols
5. **One tap to execute** the recommendation, or switch to an alternative

The user never has to pick a protocol upfront. The agent does the work and explains why.

### 6.2 Swap Comparison Flow

User says "Swap 10 KAS for NACHO" →

- AI calls `zealous_getSwapQuote` AND `kroko_getSwapQuote`
- Both results return to the AI
- AI responds with natural language recommendation: "KrokoSwap gives you 3% more NACHO on this swap"
- A **SwapComparisonCard** displays:
  - Recommended quote (large, prominent) with protocol label and Execute button
  - Compare section (collapsed) showing the other DEX's quote with "Use this instead" action
- User taps Execute → the **protocol-specific execution card** activates (either ZealousSwap's or KrokoSwap's depending on which was selected)

### 6.3 Card Architecture

There are now **two layers of cards**:

**Comparison cards** (new, protocol-agnostic):
- `SwapComparisonCard` — shows quotes from multiple DEXes, highlights recommendation
- `YieldComparisonCard` — shows yield opportunities across protocols (future)
- `LiquidityComparisonCard` — shows pool options across protocols (future)

**Protocol execution cards** (existing pattern, protocol-specific):
- ZealousSwap: `SwapExecutionCard`, `AddLiquidityCard`, `FarmStakeCard`, etc.
- KrokoSwap: `KrokoSwapExecutionCard` (new)

Flow: User message → AI calls tools → **Comparison card** → user picks → **Protocol execution card** handles the transaction.

### 6.4 When Comparison Doesn't Apply

- **Only one DEX has the pair** → show directly, no comparison toggle. Mention "Only available on [protocol]."
- **Portfolio overview** → show all positions from all protocols in one view, labeled by protocol. No comparison needed.
- **Transaction history** → show all transactions, label each with the protocol based on contract address matching.
- **Farm staking / InfinityPool staking** → ZealousSwap only for now. No comparison until KrokoSwap has farms.

### 6.5 AI Behavior Rules for System Prompt

The system prompt must instruct Claude to:

- **Always** check all integrated protocols for swaps and yield queries
- **Recommend one** with a clear, specific reason (best price, lower impact, deeper liquidity)
- **Label everything** with its protocol source — quotes, positions, actions
- **Never** silently pick a protocol without telling the user
- **Never** force comparison when only one protocol applies
- When prices are very close (<0.5% difference), recommend the more liquid option and say so
- Use ZealousSwap tools for farm staking, InfinityPool staking, and yield discovery (KrokoSwap doesn't have these yet)
- Use KrokoSwap when the user explicitly asks about V3, concentrated liquidity, or KrokoSwap by name

---

## 7. Prerequisites: Codebase Refactoring

> Based on: architecture-map.md, single-protocol-coupling-audit.md, multiprotocol-readiness.md

The codebase audit found ~85 hardcoding points across 35 files where ZealousSwap is assumed to be the only protocol. These must be addressed before integrating KrokoSwap. The following prep work makes shared layers multi-protocol aware without over-engineering.

### 7.1 Prep Step 1: Protocol Config Registry

**Problem:** All contract addresses live in a flat `config/contracts.ts` with no concept of "which protocol." Shared layers (system prompt, token registry) can't iterate over protocols.

**Solution:** Create a protocol registry that describes each integrated protocol. Existing `config/contracts.ts` stays unchanged — ZealousSwap tools keep importing from it directly. The registry is for shared layers that need to know about all protocols.

### 7.2 Prep Step 2: Namespace Tool Names

**Problem:** Tool names like `prepareSwap`, `getSwapQuote`, `getFarmData` are globally unique. A second protocol's swap tool would collide.

**Solution:** Prefix all existing tool names with a protocol identifier. KrokoSwap tools get their own prefix. This affects tool definitions, quick-actions mapping, and the card dispatcher.

### 7.3 Prep Step 3: Tool Card Dispatch Registry

**Problem:** The component that routes tool names to card components uses a pattern that requires editing control flow to add new entries.

**Solution:** Replace with a data-driven registry. Adding a new tool-to-card mapping becomes adding a data entry, not modifying logic. This also cleanly handles the new comparison cards alongside protocol-specific cards.

### 7.4 Prep Step 4: Composable System Prompt

**Problem:** The system prompt is one monolithic template mixing identity, protocol knowledge, and wallet context. Adding KrokoSwap knowledge means editing a giant string.

**Solution:** Split into composable blocks: identity (static), protocol blocks (one per protocol, generated from registry), wallet context (dynamic). Adding a protocol's knowledge becomes adding a registry entry with a description string.

### 7.5 Execution Order

| Step | What | Risk | Touches |
|---|---|---|---|
| 1 | Protocol config registry | None — additive | 1 new file |
| 2 | Namespace tool names | Medium — find-replace across files | ~10 files |
| 3 | Tool card dispatch registry | Low — same behavior | 1 file |
| 4 | Composable system prompt | Low — string restructure | 1 file |

All four steps are completed and verified before any KrokoSwap code is written.

---

## 8. KasAgent Integration Plan

### 8.1 New Files Needed

**Server-Side Tool Modules (`lib/ai/tools/`)**

- KrokoSwap swap tool — Quote and swap via KrokoSwap API. Calls `/quote`, returns structured data for the comparison card. Handles tradeType 0 (exact input) and 1 (exact output).
- KrokoSwap pools tool — List available V2/V3 pools via `/pools` API. Surface pool data, TVL, fee tiers.
- KrokoSwap tokens tool — Fetch KrokoSwap token list via `/tokens` API. Supplements the existing on-chain token registry with KrokoSwap-specific coverage.

**Comparison Cards (`components/chat/cards/`) — NEW LAYER**

- `SwapComparisonCard` — Protocol-agnostic card. Displays quotes from multiple DEXes. Shows recommended option prominently with reason tag. Collapsed compare section with alternatives. Each option has an action to trigger the protocol-specific execution card. This card is rendered when the AI returns results from multiple protocol swap tools in one response.

**Protocol Execution Cards (`components/chat/cards/`)**

- KrokoSwap execution card — Handles the KrokoSwap 5-step swap flow: check ERC-20 allowance to Permit2, check Permit2 allowance to Universal Router, get calldata from `/swap` API, send transaction. Uses wagmi `useSendTransaction`.

**Config**

- KrokoSwap entry in the protocol registry (created during prep step 1) with all contract addresses and protocol description for the system prompt.
- Permit2 ABI fragment added to `config/abis/`.

**Registry Updates**

- Tool index — register KrokoSwap tools
- Tool card dispatch registry — map new tool names to their cards, plus mapping for the SwapComparisonCard
- Quick actions — add follow-up prompts for KrokoSwap tool results and comparison card results (e.g., "Execute best option", "Show me more detail")

### 8.2 Phased Rollout

**Phase 0: Codebase Prep** *(before any KrokoSwap code)*

Complete all 4 prep steps from Section 7:
1. Protocol config registry
2. Namespace existing tool names
3. Tool card dispatch → registry map
4. Composable system prompt

Verify: app works identically after all prep changes. No behavior difference.

**Phase 1: Swap Comparison** *(core value — proves multi-protocol works)*

- Implement KrokoSwap swap tool module calling `/quote` and `/swap` API endpoints
- Build `SwapComparisonCard` (the new cross-protocol comparison layer)
- Build KrokoSwap execution card with Permit2 approval handling
- Add KrokoSwap to the protocol registry with system prompt description
- Update system prompt to instruct AI to query both protocols for swaps and follow the recommend + compare pattern
- Test on mainnet: WKAS ↔ token swaps, verify comparison card shows both DEXes

**Phase 2: Pool Discovery and Token Data**

- Implement KrokoSwap pools and tokens tools
- Merge KrokoSwap token data into the token registry for unified symbol resolution
- Surface pool comparison: "This pair has deeper liquidity on KrokoSwap"

**Phase 3: V3 Liquidity Positions (Future)**

- Read V3 NFT positions from the Position Manager for the connected wallet
- Surface concentrated liquidity positions in the portfolio sidebar (labeled by protocol)
- Build V3 add/remove liquidity execution cards
- Build `LiquidityComparisonCard` showing pool options across both DEXes

---

## 9. Execution Card: KrokoSwap Swap Flow Detail

This is the step-by-step logic the KrokoSwap execution card component needs to implement:

**Step 1: Check ERC-20 allowance to Permit2**

Call `token.allowance(userAddress, PERMIT2_ADDRESS)`. If insufficient, send an `approve(PERMIT2, MaxUint256)` transaction and wait for receipt.

**Step 2: Check Permit2 allowance to Universal Router**

Call `permit2.allowance(userAddress, tokenIn, UNIVERSAL_ROUTER)`. Returns (amount, expiration, nonce). If amount is insufficient or expiration has passed, send `permit2.approve(tokenIn, UNIVERSAL_ROUTER, MaxUint160, expiration)` and wait for receipt.

**Step 3: Get quote (already done by AI tool)**

The quote data is already available from the tool result that triggered the comparison card. The user's selection flows into this execution card.

**Step 4: Get calldata from /swap API**

POST to `/api/v1/swap` with tokenIn, tokenOut, amount, tradeType, slippage, recipient (wallet address), and deadline. The API returns `{ to, data, value }`.

**Step 5: Execute transaction**

Send the transaction using `useSendTransaction` from wagmi with the returned `to`, `data`, and `value` fields. Wait for receipt. Show success/error state with explorer link.

**For native KAS input:** Skip Steps 1 and 2 entirely. The API will set the `value` field to include the KAS amount, and the Universal Router handles wrapping automatically.

---

## 10. Required ABIs

The execution cards need these minimal ABI fragments:

**Permit2 ABI (new)**

```typescript
const PERMIT2_ABI = [
  'function approve(address token, address spender, uint160 amount, uint48 expiration)',
  'function allowance(address owner, address token, address spender) view returns (uint160, uint48, uint48)',
] as const;
```

**ERC-20 ABI (existing)**

```typescript
const ERC20_ABI = [
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;
```

No Router or Factory ABIs are needed for basic swap execution because the Swap API generates the calldata. The execution card just does `sendTransaction({ to, data, value })`.

---

## 11. Swap Example (From KrokoSwap Docs)

Complete reference implementation using ethers.js v6:

```typescript
import { ethers } from 'ethers';

const RPC_URL = 'https://evmrpc.kasplex.org';
const API_BASE = 'https://krokoswap.io/swap-api';
const PERMIT2 = '0x2E1987F680FD7Bc8B33d3Bf94f12B988A0B50034';
const UNIVERSAL_ROUTER = '0xefeCc1c2dE3BfE4C6D43030F2AcDD5C3cE279024';

async function executeSwap(signer, tokenIn, tokenOut, amount, tradeType = 0, slippage = 0.5) {
  const userAddress = await signer.getAddress();
  const token = new ethers.Contract(tokenIn, ERC20_ABI, signer);
  const permit2 = new ethers.Contract(PERMIT2, PERMIT2_ABI, signer);

  // Step 1: Approve token → Permit2
  const tokenAllowance = await token.allowance(userAddress, PERMIT2);
  if (tokenAllowance < BigInt(amount)) {
    const tx = await token.approve(PERMIT2, ethers.MaxUint256);
    await tx.wait();
  }

  // Step 2: Permit2 → approve Universal Router
  const [p2Amount, p2Expiration] = await permit2.allowance(userAddress, tokenIn, UNIVERSAL_ROUTER);
  const now = Math.floor(Date.now() / 1000);
  if (p2Amount < BigInt(amount) || Number(p2Expiration) < now) {
    const tx = await permit2.approve(tokenIn, UNIVERSAL_ROUTER, ethers.MaxUint160, now + 365 * 24 * 60 * 60);
    await tx.wait();
  }

  // Step 3: Get quote
  const quoteParams = new URLSearchParams({ tokenIn, tokenOut, amountIn: amount, tradeType: '0' });
  const quoteRes = await fetch(`${API_BASE}/api/v1/quote?${quoteParams}`);
  const quote = await quoteRes.json();

  // Step 4: Get calldata
  const swapRes = await fetch(`${API_BASE}/api/v1/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenIn, tokenOut, amountIn: amount, tradeType, slippage, recipient: userAddress, deadline: 1200 }),
  });
  const swapData = await swapRes.json();

  // Step 5: Execute
  const tx = await signer.sendTransaction({ to: swapData.to, data: swapData.data, value: swapData.value });
  const receipt = await tx.wait();
  return receipt;
}
```

---

## 12. Reference Links

- **KrokoSwap Docs:** https://docs.krokoswap.io
- **Contracts:** https://docs.krokoswap.io/contracts/addresses
- **API Reference:** https://docs.krokoswap.io/api/overview
- **Swap Example:** https://docs.krokoswap.io/examples/swap-example
- **V2 Liquidity Guide:** https://docs.krokoswap.io/examples/add-liquidity-v2-example
- **V3 Liquidity Guide:** https://docs.krokoswap.io/examples/add-liquidity-v3-example
- **Execute a Swap Guide:** https://docs.krokoswap.io/guides/execute-a-swap
- **Query Prices Guide:** https://docs.krokoswap.io/guides/query-prices
- **Kasplex Explorer:** https://explorer.kasplex.org
- **KrokoSwap Twitter:** https://x.com/Kroko_Swap
