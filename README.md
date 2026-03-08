# KasAgent

KasAgent is an AI DeFi copilot for Kasplex L2. It combines a wallet-connected chat interface with on-chain tooling so users can inspect their portfolio, discover yield, and execute ZealousSwap actions through natural language.

This repository implements the current KasAgent web app and follows the product direction in [PRD.md](./PRD.md).

## What KasAgent Does

- Connects an EVM wallet on Kasplex L2
- Reads wallet balances, LP positions, farm positions, and InfinityPool staking positions
- Provides an AI chat UI backed by tool calls and structured response cards
- Surfaces swap quotes, pool reserves, farm data, yield opportunities, and transaction history
- Can prepare and execute DeFi actions such as swaps, liquidity actions, farm staking, and InfinityPool staking
- Persists conversation history per wallet via Supabase, with a sidebar for browsing past chats
- Keeps transaction signing non-custodial in the user's wallet

## Current MVP Scope

The app is focused on the Kasplex L2 ecosystem and ZealousSwap.

Implemented areas in this codebase include:

- Wallet connection with `wagmi` + `RainbowKit`
- Portfolio aggregation hooks for balances, LPs, farms, and staking
- Chat-driven UI with inline tool result cards
- Database-backed conversation persistence (Supabase Postgres) with tabbed sidebar (Chats | Portfolio)
- Anthropic-powered AI route for intent handling and tool orchestration
- Direct execution cards for swap, add/remove liquidity, farm stake/unstake, and InfinityPool stake/unstake
- Explorer-backed recent transaction history in chat
- ZealousSwap-oriented tool modules for:
  - swaps
  - liquidity
  - farms
  - staking
  - yield discovery
  - transaction history

Tokens are discovered dynamically on-chain from ZealousSwap Factory pairs — no hardcoded token list. The server-side registry (`lib/token-registry.ts`) caches discovered tokens for 5 minutes; the client-side hook (`hooks/useTokenRegistry.ts`) provides the same data to UI components. KAS (native) and WKAS are always included.

Not in scope for this repo today:

- autonomous agent execution
- multi-chain support
- mobile app experience
- fiat on/off ramps

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- `wagmi`, `viem`, `RainbowKit`
- Vercel AI SDK
- Anthropic Claude
- Supabase (Postgres — conversation persistence)

## Network and Protocol

### Kasplex L2

- Chain ID: `202555`
- RPC: `https://evmrpc.kasplex.org`
- Explorer: `https://explorer.kasplex.org`
- Native token: `KAS`

### ZealousSwap Contracts

- Router: `0xA5B0946D31aD2d251e0fe2dfEA8808BFd475e607`
- Factory: `0x98Bb580A77eE329796a79aBd05c6D2F2b3D5E1bD`
- MasterChef: `0x97ac386fFf8d25Bc3F949194f74a79E94617bc7F`
- InfinityPool ZEAL: `0x1E7748BA1d372186a322E7CfaAB1306f19FfB897`
- InfinityPool NACHO: `0x0d4f07811718C0eE57EA2FCDb844c3585ae0F315`
- InfinityPool KASPER: `0xa1074f1cD056862ebA654344518aa8c6DE0afE74`
- WKAS: `0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e`

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Create local environment variables

Copy `.env.local.example` to `.env.local` and fill in the required values:

```bash
cp .env.local.example .env.local
# PowerShell
copy .env.local.example .env.local
```

Required variables:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
ANTHROPIC_API_KEY=your_anthropic_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

### 4. Connect a wallet

Use a wallet supported by RainbowKit, then switch to Kasplex L2 if prompted.

## Available Scripts

- `npm run dev` - start the local development server
- `npm run build` - build the production app
- `npm run start` - run the production build
- `npm run lint` - run ESLint

## Project Structure

```text
app/
  api/chat/route.ts                AI chat endpoint
  api/conversations/route.ts       list conversations (GET)
  api/conversations/[id]/route.ts  load/delete conversation (GET/DELETE)
  api/conversations/save/route.ts  create or update conversation (POST)
  page.tsx                         main application shell
  providers.tsx                    wagmi, query, and RainbowKit providers
components/
  chat/                            chat UI, message rendering, action cards
  header/                          app header and network status
  sidebar/
    PortfolioSidebar.tsx           tabbed sidebar (Chats | Portfolio)
    ConversationList.tsx           conversation list grouped by time
config/
  chains.ts                        Kasplex L2 chain definition
  contracts.ts                     ZealousSwap contract addresses
  tokens.ts                        KAS_NATIVE constant, Token interface, TOKEN_LOGOS map
hooks/
  usePortfolio.ts                  aggregated wallet portfolio state
  useConversations.ts              conversation CRUD, sidebar tab state, chatLoadKey
  useTokenRegistry.ts              client-side dynamic token discovery from Factory pairs
  use*.ts                          on-chain data hooks
lib/
  supabase.ts                      server-side Supabase client (service role key)
  token-registry.ts                server-side token discovery (5-min cache, used by AI tools)
  viem-client.ts                   shared viem public client instance
lib/ai/
  system-prompt.ts                 model instructions and wallet context (async, uses token registry)
  tools/                           AI tool modules by domain
```

## AI Tooling

The chat route in `app/api/chat/route.ts` streams responses from Anthropic and exposes a modular tool layer from `lib/ai/tools/`.

Current tool domains:

- `swap` — multi-hop routing through WKAS when no direct pair exists
- `liquidity`
- `farms`
- `staking`
- `yield`
- `history`

Token resolution in AI tools is fully dynamic — symbols and decimals are looked up from the on-chain registry (`lib/token-registry.ts`) at execution time, so new tokens listed on ZealousSwap are automatically supported.

The UI renders tool outputs as dedicated cards instead of flattening everything into plain text. That is a core product decision from the PRD.

## Product Direction

KasAgent is being built in phases:

1. AI DeFi copilot on Kasplex L2
2. AI wallet agent with user-defined safety policies
3. Multi-chain expansion across the Kaspa ecosystem

This repository is the Phase 1 foundation.

## Safety Notes

- KasAgent is non-custodial
- Users sign transactions in their own wallet
- The product is intended as an informational and execution-assist tool, not financial advice

## Reference

- Product requirements: [PRD.md](./PRD.md)
