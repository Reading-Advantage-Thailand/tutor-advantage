"use client";

import { ErrorState } from "@/components/app";

export default function SettlementRunError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState page onRetry={reset} digest={error.digest} />;
}
