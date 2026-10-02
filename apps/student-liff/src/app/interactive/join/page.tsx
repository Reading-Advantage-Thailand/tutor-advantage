import Link from "next/link";
import { QrCode } from "lucide-react";
import { AppBar, Screen, StatusScreen } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Retired PIN join: students now enter a live lesson from the class link / QR code. */
export default function JoinLessonPage() {
  return (
    <Screen>
      <AppBar title={t("interactiveJoin.appBarTitle")} back fallbackHref="/dashboard" />
      <StatusScreen
        icon={QrCode}
        tone="brand"
        title={t("interactiveJoin.title")}
        description={t("interactiveJoin.description")}
        primaryAction={
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "brand", size: "cta" }), "w-full")}>
            {t("interactiveJoin.backHome")}
          </Link>
        }
      />
    </Screen>
  );
}
