"use client";

import { ErrorState } from "@/components/app";

export default function SettlementsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState page as="h1" onRetry={reset} digest={error.digest} />;
}
