/**
 * Canonical client-side XP preview for the simple 3-arg `score / correct /
 * attempts` model.
 *
 * Returns `Math.floor(correctAnswers * accuracy)` (i.e. `correctAnswers *
 * (correctAnswers / totalAttempts)`), or 0 when there are no attempts. This
 * is a DISPLAY PREVIEW only — the server-side `calculateGameXP` from
 * `@reading-advantage/domain/games` is the authoritative XP computation
 * (Phase 3 Decision 3.3, carried forward in Phase 5 Decision 5.3).
 *
 * The 8 per-game `calculateXP(state)` functions in `hauntedLibrary.ts`,
 * `realmCarver.ts`, `paladinsTwinSoul.ts`, `griffinSkyJoust.ts`,
 * `gryphonPatrol.ts`, `griffinRidersEscape.ts`, `shadowGateDungeon.ts`, and
 * `runeForgeChamber.ts` are game-specific state-to-XP mappers and remain
 * unchanged. Only the two duplicate 3-arg `xp.ts` files are consolidated here.
 *
 * Renamed from `calculateXP` to `calculateClientXP` to make the
 * display-preview vs. authoritative-XP distinction explicit at every call
 * site.
 *
 * Labeled integer examples (A3 defense):
 *   calculateClientXP(100, 10, 10) → 10  // 10 correct * 1.0 accuracy = 10
 *   calculateClientXP(100, 5, 10)  → 2   // 5 correct * 0.5 accuracy = 2.5 → 2
 *   calculateClientXP(0, 0, 0)     → 0   // edge case: no attempts
 *   calculateClientXP(150, 10, 15) → 6   // 10 correct * 0.666... = 6
 */
export function calculateClientXP(
  score: number,
  correctAnswers: number,
  totalAttempts: number,
): number {
  if (totalAttempts === 0) return 0

  const accuracy = correctAnswers / totalAttempts

  // Formula: Correct Answers * Accuracy
  return Math.floor(correctAnswers * accuracy)
}