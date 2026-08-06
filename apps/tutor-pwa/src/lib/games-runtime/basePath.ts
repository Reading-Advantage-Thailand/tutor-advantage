/**
 * Canonical `withBasePath` for Advantage Games.
 *
 * Prefixes a path with `process.env.NEXT_PUBLIC_BASE_PATH` when set; otherwise
 * returns the path unchanged. Used by `gameCards.ts` (cover image URLs +
 * locale-agnostic `/student/games/...` hrefs) so static-export hosts can be
 * served under a sub-path.
 *
 * The duplicate `withBasePath` files at `@/lib/basePath.ts` and
 * `@/lib/games/basePath.ts` are re-export shims so unmigrated consumers
 * continue to work (see `phase-5-decisions.md` Decision 5.3).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const withBasePath = (path: string) => {
  if (!path.startsWith('/')) {
    return `${basePath}/${path}`
  }
  return `${basePath}${path}`
}