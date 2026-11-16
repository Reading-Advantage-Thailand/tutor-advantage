"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ErrorState } from "@/components/app/ErrorState";
import { LessonContent } from "@/components/app/LessonShell";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Lesson route error (patterns.md "Error (load)", tutor): 56 tone tile, cause, retry + back to the class. */
export default function LessonError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ id: string }>();
  return (
    <LessonContent width="narrow" className="flex-1 justify-center">
      <ErrorState
        page
        description={t("shell.errorPageBody")}
        onRetry={reset}
        digest={error.digest}
        action={
          <Link href={`/dashboard/classes/${params?.id ?? ""}`} className={buttonVariants({ variant: "ghost" })}>
            <ArrowLeft aria-hidden="true" />
            {t("shell.lessonBackToClass")}
          </Link>
        }
      />
    </LessonContent>
  );
}
