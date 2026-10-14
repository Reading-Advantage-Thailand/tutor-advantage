import Link from "next/link";
import { Compass } from "lucide-react";
// Deep imports keep the client barrel out of this server component.
import { StatusScreen } from "@/components/mobile/Feedback";
import { Screen } from "@/components/mobile/Screen";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** 404 (server component: the copy is rendered on the server, no client JS of its own). */
export default function NotFound() {
  return (
    <Screen>
      <StatusScreen
        icon={Compass}
        tone="blue"
        title={t("notFound.title")}
        description={t("notFound.description")}
        primaryAction={
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "brand", size: "cta" }), "w-full")}>
            {t("common.goHome")}
          </Link>
        }
      />
    </Screen>
  );
}
