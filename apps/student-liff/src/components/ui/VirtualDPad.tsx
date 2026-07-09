/**
 * Re-export shim — canonical `VirtualDPad` lives at `@/lib/games-runtime`.
 *
 * This file is preserved so the games that import from `@/components/games/ui/VirtualDPad`
 * (shadow-gate-dungeon, labyrinth-goblin-king, village-guardian,
 * castle-defense) keep working without modification. Phase 5 Decision 5.7
 * keeps the duplicate-file drop as `[b] deferred:infra` — the successor
 * track drops this shim once all games migrate to the canonical
 * `@/lib/games-runtime` import path.
 */

export { VirtualDPad } from '@/lib/games-runtime'
export type { VirtualDPadProps } from '@/lib/games-runtime'