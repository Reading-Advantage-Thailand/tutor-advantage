"use client";

import { useEffect, useState } from "react";
import { Confetti } from "@/components/celebrate/Confetti";
import { claimBookCelebration } from "./bookCompleteCelebration";

/** One-time confetti the first time a finished book is shown on Progress. */
export function BookCompleteCelebration({
  bookCycleId,
  isComplete,
}: {
  bookCycleId: string | null | undefined;
  isComplete: boolean | undefined;
}) {
  const [fireFor, setFireFor] = useState<string | null>(null);

  useEffect(() => {
    if (bookCycleId && claimBookCelebration(bookCycleId, isComplete)) setFireFor(bookCycleId);
  }, [bookCycleId, isComplete]);

  return <Confetti fire={fireFor} intensity="big" origin={{ x: 0.5, y: 0.3 }} />;
}
