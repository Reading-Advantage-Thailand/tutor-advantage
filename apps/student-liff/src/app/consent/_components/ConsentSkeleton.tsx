import { AppBar } from "@/components/mobile/AppBar";
import { ListGroup, ListRowSkeleton } from "@/components/mobile/List";
import { Screen } from "@/components/mobile/Screen";
import { LoadingAnnouncement } from "@/components/mobile/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n";

/** Loading state of /consent (used by loading.tsx and the page's own loading branch). */
export function ConsentSkeleton() {
  return (
    <Screen>
      <AppBar title={t("legal.consentTitle")} back fallbackHref="/profile" />
      <LoadingAnnouncement />
      <div aria-hidden="true" className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-2">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-full rounded-full" />
          <Skeleton className="h-3.5 w-3/5 rounded-full" />
        </div>
        <ListGroup header={t("legal.consentStatusHeader")}>
          <ListRowSkeleton count={2} />
        </ListGroup>
        <Skeleton className="h-24 w-full rounded-2xl" />
        <ListGroup header={t("legal.documentsHeader")}>
          <ListRowSkeleton count={2} subtitle={false} />
        </ListGroup>
      </div>
    </Screen>
  );
}
