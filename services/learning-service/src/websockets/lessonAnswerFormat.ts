const STORED_CHOICE_PREFIX = /^\s*ตัวเลือก\s+([A-D])\s*:/i;

/**
 * Session answers are persisted with a human-readable prefix for lesson
 * history (for example, "ตัวเลือก D: Green"). Live lesson state, however,
 * uses the bare option label. Convert persisted answers back to that wire
 * format when a session is recovered.
 */
export function restoreChoiceAnswerLabel(answerText: string | null | undefined): string | undefined {
  if (answerText == null) return undefined;

  const trimmed = answerText.trim();
  const storedChoice = trimmed.match(STORED_CHOICE_PREFIX);
  if (storedChoice) return storedChoice[1].toUpperCase();

  return /^[A-D]$/i.test(trimmed) ? trimmed.toUpperCase() : trimmed;
}
