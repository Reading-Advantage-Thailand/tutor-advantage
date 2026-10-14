import Link from "next/link";
import { Clock } from "lucide-react";
import { AppBar, Screen, StatusScreen } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function StudyPage() {
  return (
    <Screen>
      <AppBar title={t("study.appBarTitle")} back fallbackHref="/dashboard" />
      <StatusScreen
        icon={Clock}
        tone="brand"
        title={t("study.comingSoonTitle")}
        description={t("study.comingSoonDesc")}
        primaryAction={
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "brand", size: "cta" }), "w-full")}>
            {t("study.backHome")}
          </Link>
        }
      />
    </Screen>
  );
}
