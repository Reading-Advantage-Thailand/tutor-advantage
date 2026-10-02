// Routes between the live-lesson lobby and the live lesson. Both directions use
// router.replace (not push): with push, Android back from the lesson landed on
// the lobby, which immediately pushed the lesson again and trapped the student.

/**
 * Live lesson URL. Only classId is passed: the play page never read the old
 * `studentName` param, and an unencoded Thai name could break the query.
 */
export function buildPlayUrl(classId: string): string {
  return `/interactive/play?classId=${encodeURIComponent(classId)}`;
}

/** Lobby of a class (the live lesson goes back here while the session is in phase 0). */
export function buildLobbyUrl(classId: string): string {
  return `/lesson/${encodeURIComponent(classId)}`;
}
