"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ErrorState } from "@/components/app/ErrorState";
import { t } from "@/lib/i18n";

/** Inline error for a failed class-articles load; retry re-renders the server page. */
export function ArticlesLoadError({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <ErrorState
      compact={compact}
      title={t("lesson.preflow.articlesLoadFailed")}
      description={t("lesson.preflow.articlesLoadFailedBody")}
      onRetry={() =>
        new Promise<void>((resolve) => {
          startTransition(() => {
            router.refresh();
            resolve();
          });
        })
      }
    />
  );
}
