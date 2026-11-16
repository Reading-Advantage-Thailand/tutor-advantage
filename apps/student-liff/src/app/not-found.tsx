import Link from "next/link";
import { Compass } from "lucide-react";
// Deep imports keep the client barrel out of this server component.
import { StatusScreen } from "@/components/mobile/Feedback";
import { Screen } from "@/components/mobile/Screen";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * 404 (patterns.md "Empty, error and loading"): StatusScreen with Reedy oops
 * 120 (the compass stays as his badge), "ไม่พบหน้านี้" as the page h1 and the
 * one primary "กลับหน้าหลัก". Server component: no client JS of its own.
 */
export default function NotFound() {
  return (
    <Screen>
      <StatusScreen
        as="h1"
        icon={Compass}
        tone="blue"
        variant="notFound"
        title={t("notFound.title")}
        description={t("notFound.description")}
        primaryAction={
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "brand", size: "cta-lg" }), "w-full")}>
            {t("common.goHome")}
          </Link>
        }
      />
    </Screen>
  );
}
