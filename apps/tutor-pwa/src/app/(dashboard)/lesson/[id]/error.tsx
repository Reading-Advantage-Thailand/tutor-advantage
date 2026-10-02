"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ErrorState } from "@/components/app/ErrorState";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function LessonError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ id: string }>();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <ErrorState
        page
        description={t("shell.errorPageBody")}
        onRetry={reset}
        digest={error.digest}
        action={
          <Link href={`/dashboard/classes/${params?.id ?? ""}`} className={buttonVariants({ variant: "ghost" })}>
            {t("shell.lessonBackToClass")}
          </Link>
        }
      />
    </div>
  );
}
