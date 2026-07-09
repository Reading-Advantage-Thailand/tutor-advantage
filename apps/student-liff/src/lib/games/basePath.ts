/**
 * Re-export shim — canonical `withBasePath` lives at `@/lib/games-runtime`.
 *
 * Preserved for the consumers that import from `@/lib/games/basePath`. Phase 5
 * Decision 5.7 keeps the duplicate-file drop as `[b] deferred:infra`.
 */

export { withBasePath } from '@/lib/games-runtime'