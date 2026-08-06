/**
 * Canonical games runtime barrel.
 *
 * Single source of truth for the three duplicated primitives that Phase 5
 * consolidated (`phase-5-decisions.md` Decision 5.3):
 *
 * - `VirtualDPad` — memoized, polished implementation (replaces the two
 *   divergent duplicate files at `@/components/ui/VirtualDPad.tsx` and
 *   `@/components/games/ui/VirtualDPad.tsx`). Those duplicates are now
 *   re-export shims so the 24 unmigrated games that import from the legacy
 *   paths keep working without a hidden window.location-style break.
 *
 * - `withBasePath` — base-path prefix helper (replaces the two duplicate
 *   `basePath.ts` files at `@/lib/basePath.ts` and `@/lib/games/basePath.ts`).
 *   Both duplicates are now re-export shims.
 *
 * - `calculateClientXP` — the 3-arg client-side XP preview (renamed from
 *   `calculateXP` so the display-preview vs. authoritative-XP distinction is
 *   explicit at call sites). The two duplicate `xp.ts` files at `@/lib/xp.ts`
 *   and `@/lib/games/xp.ts` are now re-export shims. The 8 per-game
 *   `calculateXP(state)` functions are NOT consolidated — they are
 *   correctly game-specific state→XP mappers.
 *
 * The duplicate-file drop and the `packages/games-runtime` workspace
 * extraction are `[b] deferred:infra` per Phase 5 Decision 5.7.
 */

export { VirtualDPad } from './VirtualDPad'
export type { VirtualDPadProps } from './VirtualDPad'

export { withBasePath } from './basePath'

export { calculateClientXP } from './xp'