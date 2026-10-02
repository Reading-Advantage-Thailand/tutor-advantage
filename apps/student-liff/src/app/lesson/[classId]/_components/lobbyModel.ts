// Pure view-model helpers for the live-lesson lobby.
// Relative imports only: vitest maps "@" to another app.
import { t } from "../../../../lib/i18n";

export type LobbyActivityMode = "PRE" | "POST" | "LESSON";

/** Same ordering as before: the current student first, everyone else unchanged. */
export function sortParticipantsMeFirst<T extends { studentId: string }>(participants: T[], studentId: string): T[] {
  return [...participants].sort((a, b) => (a.studentId === studentId ? -1 : b.studentId === studentId ? 1 : 0));
}

interface AssessmentLike {
  supported?: boolean;
  mode?: string;
  status?: string;
}

/** The lobby hands the whole screen to the live pre/post assessment while it runs before the lesson. */
export function shouldShowLiveAssessment(state: AssessmentLike | null | undefined, currentPhase: number | undefined): boolean {
  return Boolean(state?.supported && state.mode !== "LESSON" && state.status !== "LOBBY" && currentPhase === 0);
}

/** Activity the tutor picked for this room (the assessment mode when supported, else the lesson). */
export function getLobbyActivityMode(state: AssessmentLike | null | undefined): LobbyActivityMode {
  if (!state?.supported) return "LESSON";
  return state.mode === "PRE" || state.mode === "POST" ? state.mode : "LESSON";
}

export function getLobbyActivity(mode: LobbyActivityMode, isReady: boolean): { title: string; description: string } {
  const title =
    mode === "PRE"
      ? t("lessonLobby.activityPre")
      : mode === "POST"
        ? t("lessonLobby.activityPost")
        : t("lessonLobby.activityLesson");
  const description =
    mode === "LESSON"
      ? t("lessonLobby.activityLessonDescription")
      : `${isReady ? t("lessonLobby.activityReadyPrefix") : t("lessonLobby.activityNotReadyPrefix")}${title}`;
  return { title, description };
}
