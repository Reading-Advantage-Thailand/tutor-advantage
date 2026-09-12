const STORED_CHOICE_PREFIX = /^\s*ตัวเลือก\s+([A-D])\s*:/i;

/** Accept both live labels ("D") and answers restored from lesson history. */
export function getChoiceAnswerLabel(answer: unknown): string | null {
  if (typeof answer !== "string") return null;

  const trimmed = answer.trim();
  const storedChoice = trimmed.match(STORED_CHOICE_PREFIX);
  const label = storedChoice?.[1] || (/^[A-D]$/i.test(trimmed) ? trimmed : null);

  return label ? label.toUpperCase() : null;
}
