export function calculateClientXP(score: number, correct: number, total: number) {
  const accuracy = total > 0 ? correct / total : 0;
  return Math.round(score * accuracy + correct * 10);
}

export const calculateXP = calculateClientXP;