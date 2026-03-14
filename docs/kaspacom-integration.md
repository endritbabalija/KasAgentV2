KaspaCom Swap SDK — Direct Integration Reference

  ---
  1. Contract Addresses                                                                                                                                                            
  Kasplex Mainnet (chainId: 202555)
                                                                                                                                                                                     ┌──────────┬────────────────────────────────────────────┐                                                                                                                          │ Contract │                  Address                   │
  ├──────────┼────────────────────────────────────────────┤                                                                                                                          │ Router   │ 0x3a1f0bD164fe9D8fa18Da5abAB352dC634CA5F10 │
  ├──────────┼────────────────────────────────────────────┤
  │ Factory  │ 0xa9CBa43A407c9Eb30933EA21f7b9D74A128D613c │
  ├──────────┼────────────────────────────────────────────┤                                                                                                                          │ Proxy    │ 0x4c5BEaAE83577E3a117ce2F477fC42a1EA39A8a3 │
  ├──────────┼────────────────────────────────────────────┤                                                                                                                          │ WKAS     │ 0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e │
  └──────────┴────────────────────────────────────────────┘                                                                                                                        
  Kasplex Testnet (chainId: 167012)                                                                                                                                                
  ┌──────────┬────────────────────────────────────────────┐                                                                                                                          │ Contract │                  Address                   │
  ├──────────┼────────────────────────────────────────────┤
  │ Router   │ 0x81Cc4e7DbC652ec9168Bc2F4435C02d7F315148e │
  ├──────────┼────────────────────────────────────────────┤
  │ Factory  │ 0x89d5842017ceA7dd18D10EE6c679cE199d2aD99E │
  ├──────────┼────────────────────────────────────────────┤                                                                                                                          │ Proxy    │ 0x5B7e7830851816f8ad968B0e0c336bd50b4860Ad │
  ├──────────┼────────────────────────────────────────────┤                                                                                                                          │ WKAS     │ 0xf40178040278E16c8813dB20a84119A605812FB3 │
  └──────────┴────────────────────────────────────────────┘                                                                                                                        
  Igra Galleon Testnet (chainId: 38836)                                                                                                                                            
  ┌──────────┬────────────────────────────────────────────┐                                                                                                                          │ Contract │                  Address                   │
  ├──────────┼────────────────────────────────────────────┤
  │ Router   │ 0x9a5514828a3c2b36920b7c4fe0d6bd7fe8e8924f │
  ├──────────┼────────────────────────────────────────────┤
  │ Factory  │ 0x1a8136A6da6CA7fe8960c4d098d90Ba2BA712B9F │
  ├──────────┼────────────────────────────────────────────┤                                                                                                                          │ Proxy    │ 0x47f80b6d7071b7738d6dd9d973d7515ce753e9d9 │
  ├──────────┼────────────────────────────────────────────┤                                                                                                                          │ WKAS     │ 0x65C280485cA2Ea32aB6A684E2e0646ff1F842A80 │
  └──────────┴────────────────────────────────────────────┘                                                                                                                        
  All WKAS tokens use 18 decimals.                                                                                                                                                 
  ---                                                                                                                                                                                2. ABIs
                                                                                                                                                                                     Router ABI (relevant functions)
                                                                                                                                                                                     [                                                                                                                                                                                    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
    "function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)",
    "function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut)",
    "function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) external pure returns (uint amountIn)",
    "function WETH() external pure returns (address)"                                                                                                                                ]
                                                                                                                                                                                     Factory ABI                                                                                                                                                                      
  [                                                                                                                                                                                    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
    "function allPairs(uint) external view returns (address pair)",
    "function allPairsLength() external view returns (uint)"                                                                                                                         ]
                                                                                                                                                                                     Proxy ABI (superset of Router, adds)                                                                                                                                             
  [                                                                                                                                                                                    "function partners(bytes32) external view returns (address feeRecipient, uint16 feeBps)"
  ]                                                                                                                                                                                
  ERC20 (minimum for approvals)                                                                                                                                                    
  [
    "function allowance(address owner, address spender) external view returns (uint256)",                                                                                              "function approve(address spender, uint256 amount) external returns (bool)"
  ]                                                                                                                                                                                
  ---                                                                                                                                                                                3. INIT_CODE_HASH

  Not present in the codebase. The SDK does not compute pair addresses locally. It either:
  - Calls factory.getPair(tokenA, tokenB) on-chain, or                                                                                                                               - Fetches pre-indexed pair data from the backend API (/dex/graph-pairs?network=...)                                                                                              
  If you need pair addresses locally, use factory.getPair().
                                                                                                                                                                                     ---
  4. API Endpoints & External URLs
                                                                                                                                                                                     RPC Endpoints
                                                                                                                                                                                     ┌─────────────────┬───────────────────────────────────────────┐                                                                                                                    │     Network     │                    URL                    │
  ├─────────────────┼───────────────────────────────────────────┤                                                                                                                    │ Kasplex Mainnet │ https://evmrpc.kasplex.org                │
  ├─────────────────┼───────────────────────────────────────────┤
  │ Kasplex Testnet │ https://rpc.kasplextest.xyz               │
  ├─────────────────┼───────────────────────────────────────────┤                                                                                                                    │ Igra Testnet    │ https://galleon-testnet.igralabs.com:8545 │
  └─────────────────┴───────────────────────────────────────────┘                                                                                                                  
  Kasplex RPC nodes require batch options: batchMaxCount: 1, batchMaxSize: 1, batchStallTime: 0.                                                                                   
  DeFi API                                                                                                                                                                         
  ┌─────────┬────────────────────────────────┐                                                                                                                                       │ Network │            Base URL            │
  ├─────────┼────────────────────────────────┤                                                                                                                                       │ Mainnet │ https://api-defi.kaspa.com     │
  ├─────────┼────────────────────────────────┤
  │ Testnet │ https://dev-api-defi.kaspa.com │
  └─────────┴────────────────────────────────┘                                                                                                                                                                                                                                                                                                                          Pair data endpoint:                                                                                                                                                                GET {apiBaseUrl}/dex/graph-pairs?network={networkName}
                                                                                                                                                                                     Network name mapping:
  - Kasplex Mainnet → kasplex                                                                                                                                                        - Kasplex Testnet → kasplex                                                                                                                                                        - Igra Testnet → igra

  Returns an array of pair objects with token info, reserves, prices, and volume.
                                                                                                                                                                                     Block Explorers
                                                                                                                                                                                     ┌─────────────────┬───────────────────────────────────────────────┐
  │     Network     │                      URL                      │
  ├─────────────────┼───────────────────────────────────────────────┤
  │ Kasplex Mainnet │ https://explorer.kasplex.org                  │
  ├─────────────────┼───────────────────────────────────────────────┤
  │ Kasplex Testnet │ https://explorer.testnet.kasplextest.xyz      │
  ├─────────────────┼───────────────────────────────────────────────┤                                                                                                                │ Igra Testnet    │ https://explorer.galleon-testnet.igralabs.com │
  └─────────────────┴───────────────────────────────────────────────┘                                                                                                              
  ---                                                                                                                                                                                5. Proxy Contract — Role in Swap Flow

  The proxy is an intermediary contract wrapping the router. It exists to support partner fees.
                                                                                                                                                                                     Key behaviors:
  - Stores partner configs: partners(bytes32 partnerKey) → (address feeRecipient, uint16 feeBps)                                                                                     - Accepts the same swap function signatures as the router                                                                                                                          - When invoked via proxy, swap calldata is encoded with a custom suffix that carries the partner key
                                                                                                                                                                                     Calldata encoding (sent to proxy):                                                                                                                                                 [4-byte function selector]
  [ABI-encoded swap parameters]
  [1-byte array length (0x00)]
  [16-byte marker: bytes16(keccak256("PERMIT"))]
  [32-byte partnerKey]              ← only if partner fee applies
  [16-byte partner flag hash]       ← only if partner fee applies
                                                                                                                                                                                     If you don't need partner fees, call the router directly — the proxy is optional.
                                                                                                                                                                                     Approval target: When using the proxy, the ERC20 approve() spender must be the proxy address, not the router.                                                                    
  ---                                                                                                                                                                                6. Fee Structure

  DEX Fee (protocol-level, always applied)
                                                                                                                                                                                     1% fee hardcoded in the CustomFeePair class that overrides Uniswap V2's pair math:                                                                                                                                                                                                                                                                                    // Exact input                                                                                                                                                                     inputAmountWithFee = inputAmount × 99 / 100
  outputAmount = (inputAmountWithFee × outputReserve) / (inputReserve + inputAmountWithFee)
                                                                                                                                                                                     // Exact output
  inputAmount = ((inputReserve × outputAmount) × 100) / ((outputReserve − outputAmount) × 99) + 1
                                                                                                                                                                                     This is baked into all quote calculations and is separate from partner fees.                                                                                                                                                                                                                                                                                          Partner Fee (optional, proxy only)                                                                                                                                               
  - Denominated in basis points (BPS), divisor = 10,000                                                                                                                              - Retrieved via: proxy.partners(partnerKey) → (feeRecipient, feeBps)
  - Applied on top of the DEX fee
                                                                                                                                                                                     Exact input (user specifies sell amount):                                                                                                                                          actualAmountOut = amountOut × (10,000 − feeBps) / 10,000

  Exact output (user specifies buy amount):
  requiredAmountIn = (amountIn × 10,000) / (10,000 − feeBps)  [ceiling division]                                                                                                   
  Default partner fee is 0 BPS (no fee) if no partner key is configured or the proxy returns zero.
                                                                                                                                                                                     ---
  7. Swap Execution Flow                                                                                                                                                           
  Step 1 — Initialization
                                                                                                                                                                                     1. Instantiate contracts: RouterContract, FactoryContract, optionally ProxyContract                                                                                                2. Fetch pairs from API: GET /dex/graph-pairs?network=... → build Uniswap V2 Pair objects using CustomFeePair (1% fee)
  3. If partner key: call proxy.partners(partnerKey) to load feeBps
                                                                                                                                                                                     Step 2 — Wallet Connection
                                                                                                                                                                                     1. eth_requestAccounts → get signer address                                                                                                                                        2. eth_chainId → verify correct network; call wallet_switchEthereumChain / wallet_addEthereumChain if needed
  3. Attach signer to router and proxy contracts
                                                                                                                                                                                     Step 3 — Quote                                                                                                                                                                                                                                                                                                                                                        1. Wrap native token address (0x000...) → WKAS for routing                                                                                                                         2. Run Trade.bestTradeExactIn() or bestTradeExactOut() through loaded pairs (max 3 hops)
  3. Confirm on-chain via router.getAmountsOut(amountIn, path) or router.getAmountsIn(amountOut, path)
  4. Apply slippage: minOut = amountOut × (1 − slippage) / maxIn = amountIn × (1 + slippage)
  5. Apply partner fee adjustment to the final displayed amounts
                                                                                                                                                                                     Step 4 — Approval (ERC20 only)                                                                                                                                                                                                                                                                                                                                        1. Check token.allowance(userAddress, spenderAddress)                                                                                                                                - Spender = proxy address (if proxy configured), else router address
  2. If allowance < required: call token.approve(spender, MaxUint256)
                                                                                                                                                                                     Step 5 — Swap Transaction
                                                                                                                                                                                     Function selection matrix:                                                                                                                                                       
  ┌──────────────────┬────────┬──────────────┬──────────────────────────┐                                                                                                            │       From       │   To   │ isExactInput │         Function         │
  ├──────────────────┼────────┼──────────────┼──────────────────────────┤                                                                                                            │ Native (ETH/KAS) │ Token  │ ✓            │ swapExactETHForTokens    │
  ├──────────────────┼────────┼──────────────┼──────────────────────────┤
  │ Token            │ Native │ ✓            │ swapExactTokensForETH    │                                                                                                            ├──────────────────┼────────┼──────────────┼──────────────────────────┤
  │ Token            │ Token  │ ✓            │ swapExactTokensForTokens │
  ├──────────────────┼────────┼──────────────┼──────────────────────────┤                                                                                                            │ Native           │ Token  │ ✗            │ swapETHForExactTokens    │
  ├──────────────────┼────────┼──────────────┼──────────────────────────┤                                                                                                            │ Token            │ Native │ ✗            │ swapTokensForExactETH    │
  ├──────────────────┼────────┼──────────────┼──────────────────────────┤                                                                                                            │ Token            │ Token  │ ✗            │ swapTokensForExactTokens │
  └──────────────────┴────────┴──────────────┴──────────────────────────┘                                                                                                          
  Transaction construction:                                                                                                                                                          1. ABI-encode the selected function call
  2. If proxy: append partner calldata suffix (see Section 5)                                                                                                                        3. Send:
  {                                                                                                                                                                                    to: proxyAddress || routerAddress,
    from: signerAddress,                                                                                                                                                               data: encodedCalldata,
    value: amountIn  // only if fromToken is native
  }
  4. Wait for receipt; verify receipt.status === 1                                                                                                                                                                                                                                                                                                                      Default Parameters                                                                                                                                                               
  maxSlippage:  0.5%
  deadline:     20 minutes (currentBlockTimestamp + 20 × 60)
  maxHops:      3          