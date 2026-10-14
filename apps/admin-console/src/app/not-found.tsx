import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/app";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <EmptyState
        icon={FileQuestion}
        title={t("shell.notFoundTitle")}
        description={t("shell.notFoundBody")}
        action={
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            {t("shell.backHome")}
          </Link>
        }
        className="w-full max-w-lg"
      />
    </div>
  );
}
