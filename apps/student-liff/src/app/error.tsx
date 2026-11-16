"use client";

import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { StatusScreen } from "@/components/mobile/Feedback";
import { Screen } from "@/components/mobile/Screen";
import { Button, buttonVariants } from "@/components/ui/button";
import { clearResourceCache } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Route error boundary for the whole app (patterns.md "Empty, error and
 * loading"): the same StatusScreen as the LIFF start-up error (Reedy oops with
 * the amber warning badge, the title as the page h1), one retry that re-renders
 * the route and a way home. The root layout (providers, tab bar) stays mounted.
 *
 * The screen replaces the page without a navigation, so it is an alert (a
 * screen reader hears the title and description). Retry first empties the
 * client data cache: reset() alone re-renders the route from the same cached
 * response, so an error caused by the data would come straight back.
 */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Screen>
      <StatusScreen
        as="h1"
        role="alert"
        icon={AlertTriangle}
        tone="amber"
        title={t("common.errorTitle")}
        description={t("common.errorDescription")}
        primaryAction={
          <Button
            variant="brand"
            size="cta-lg"
            className="w-full"
            onClick={() => {
              clearResourceCache();
              reset();
            }}
          >
            <RotateCw aria-hidden="true" />
            {t("common.retry")}
          </Button>
        }
        secondaryAction={
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "cta" }), "w-full")}>
            {t("common.goHome")}
          </Link>
        }
      />
    </Screen>
  );
}
