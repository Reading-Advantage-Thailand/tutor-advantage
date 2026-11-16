"use client";

import { ErrorState } from "@/components/app";

/** Tone tile 56 + cause + retry (patterns.md "Error (load)", tutor). */
export default function AuctionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState page onRetry={reset} digest={error.digest} />;
}
