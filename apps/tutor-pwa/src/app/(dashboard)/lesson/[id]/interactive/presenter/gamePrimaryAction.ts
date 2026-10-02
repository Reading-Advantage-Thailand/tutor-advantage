/**
 * Label + disabled state of the dock's primary button during a game phase.
 * Pure so the game flow (vote → ready → demo → tutorial → countdown → play)
 * can be unit-tested without rendering the presenter.
 */
import { t } from "@/lib/i18n";

export interface GamePrimaryActionInput {
  status?: string;
  hasPlayableGame: boolean;
  teacherDemoEnabled: boolean;
  tutorialEnabled: boolean;
  /** tutorialEnabled stored on the game state when the intro started. */
  stateTutorialEnabled: boolean;
  preparationMode: boolean;
  preparationFreeExplore: boolean;
  votesCount: number;
  totalParticipants: number;
}

export function getGamePrimaryAction({
  status,
  hasPlayableGame,
  teacherDemoEnabled,
  tutorialEnabled,
  stateTutorialEnabled,
  preparationMode,
  preparationFreeExplore,
  votesCount,
  totalParticipants,
}: GamePrimaryActionInput): { label: string; disabled: boolean } {
  const label =
    status === "voting" && !hasPlayableGame
      ? t("lesson.interactive.gamesComingSoon")
      : !status
        ? t("lesson.interactive.openGameVote")
        : status === "voting"
          ? t("lesson.live.closeVote")
          : status === "ready"
            ? teacherDemoEnabled
              ? t("lesson.live.startTeacherDemo")
              : tutorialEnabled
                ? t("lesson.live.showTutorial")
                : t("lesson.live.startGameNow")
            : status === "teacher_demo"
              ? stateTutorialEnabled
                ? t("lesson.live.endDemoToTutorial")
                : t("lesson.live.endDemoStartGame")
              : status === "tutorial"
                ? t("lesson.live.startGame")
                : status === "playing" && preparationFreeExplore
                  ? t("lesson.live.showSampleResults")
                  : status === "countdown"
                    ? t("lesson.interactive.countdownInProgress")
                    : t("lesson.interactive.gamePlaying");
  const disabled =
    status === "countdown" ||
    (status === "playing" && !preparationFreeExplore) ||
    (status === "voting" && !hasPlayableGame) ||
    (!preparationFreeExplore && preparationMode && status === "voting" && votesCount < totalParticipants);
  return { label, disabled };
}
