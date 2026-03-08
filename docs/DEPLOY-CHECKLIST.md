# Deploy Checklist — 2026-03-08

## 1. `npm run build` — PASS

Build completes successfully with Next.js 16.1.6 (Turbopack).

```
Route (app)
  /            (Static)
  /_not-found  (Static)
  /api/chat    (Dynamic)
```

No build errors.

## 2. `npm run lint` — 9 errors, 2 warnings

### Errors (9) — all in `components/chat/ChatContainer.tsx`

7 errors are `react-hooks/refs` — "Cannot access refs during render". These fire on the pattern of updating `.current` during render (lines 76, 89, 93, 106, 115, 119) which is an intentional design choice for keeping refs fresh for closures and transport body functions. This pattern pre-dates our changes (lines 76, 89, 93 existed before this branch). The new persistence code (lines 115, 119) follows the same existing pattern.

1 error in `hooks/useSidebarState.ts` — `react-hooks/set-state-in-effect` for calling `setIsOpen()` inside a `useEffect`. Pre-existing, not introduced by this branch.

### Warnings (2) — pre-existing, not introduced by this branch

- `hooks/useFarmPositions.ts:5` — `FarmGlobals` imported but unused
- `hooks/useLpPositions.ts:5` — `PairInfo` imported but unused

### Verdict

All lint issues are either pre-existing or follow pre-existing patterns in the codebase. No new categories of lint errors introduced.

## 3. Environment variables in `.env.local.example` — PASS

Both required variables are documented:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — present (line 2)
- `ANTHROPIC_API_KEY` — present (line 5)

Optional variables also documented:
- `NEXT_PUBLIC_RPC_URL` — present (line 8)
- `NEXT_PUBLIC_RPC_URL_FALLBACK` — present (line 9)
- `EXPLORER_API_URL` — present (line 10)

## 4. Hardcoded `localhost` URLs — PASS

Zero matches found across all `.ts` and `.tsx` files.

## 5. `console.log` statements — PASS

Zero `console.log` statements found. All logging uses `console.error` (in `app/api/chat/route.ts` error handlers), which is appropriate for production.

## 6. `next.config.ts` — PASS

```ts
const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "@react-native-async-storage/async-storage": { browser: "" },
    },
  },
};
```

Minimal config. The `resolveAlias` is a standard workaround for WalletConnect/RainbowKit dependencies that reference React Native modules. No dev-only settings, no `reactStrictMode: false`, no experimental flags that would be problematic in production.

## 7. Build script in `package.json` — PASS

```json
"build": "next build"
```

Standard Next.js build command. No custom flags or workarounds.

## Summary

| Check | Result |
|---|---|
| `npm run build` | PASS |
| `npm run lint` | 9 errors + 2 warnings (all pre-existing or following pre-existing patterns) |
| Env vars documented | PASS |
| No hardcoded localhost | PASS |
| No console.log | PASS |
| next.config.ts | PASS — no dev-only settings |
| Build script | PASS — standard `next build` |

### Items to address before production

1. **Lint errors**: Consider adding ESLint disable comments for the intentional ref-during-render pattern in `ChatContainer.tsx`, or refactoring to use effects. The `useSidebarState.ts` setState-in-effect should be refactored to use a lazy initializer with `useState`.
2. **Unused imports**: Remove `FarmGlobals` from `useFarmPositions.ts` and `PairInfo` from `useLpPositions.ts`.
