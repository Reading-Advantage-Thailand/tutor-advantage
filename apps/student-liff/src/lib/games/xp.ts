/**
 * Re-export shim — canonical `calculateClientXP` lives at `@/lib/games-runtime`.
 *
 * The original 3-arg `calculateXP(score, correctAnswers, totalAttempts)` is
 * preserved under its old name for unmigrated consumers. The new
 * `calculateClientXP` name makes the display-preview vs. server-authoritative
 * distinction explicit at call sites. Phase 5 Decision 5.7 keeps the
 * duplicate-file drop as `[b] deferred:infra`.
 */

import { calculateClientXP } from '@/lib/games-runtime'

export const calculateXP = calculateClientXP
export { calculateClientXP }