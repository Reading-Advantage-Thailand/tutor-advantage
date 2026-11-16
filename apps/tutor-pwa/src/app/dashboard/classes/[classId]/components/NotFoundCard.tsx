import { ChevronLeft, SearchX } from "lucide-react";
import { EmptyState, Page, ShellTitle } from "@/components/app";
import { t } from "@/lib/i18n";
import { LinkButton } from "./LinkButton";

/**
 * notFound() inside a class: the shared status card (EmptyState with the page's
 * h1 and a 56px tone tile, patterns.md "Not found", tutor) inside the
 * dashboard shell, the cause, and one way back to the class list.
 * Server-compatible.
 */
export function NotFoundCard({ body }: { body: string }) {
  return (
    <Page width="narrow">
      <ShellTitle title={t("tutorClass.view.appBarTitle")} backHref="/dashboard/classes" />
      <EmptyState
        headingAs="h1"
        icon={SearchX}
        iconSize="xl"
        title={t("app.notFoundTitle")}
        description={body}
        className="min-h-[50vh] py-12"
        action={
          <LinkButton href="/dashboard/classes" size="lg" className="mt-1">
            <ChevronLeft aria-hidden="true" className="size-5" />
            {t("tutorClass.auction.back")}
          </LinkButton>
        }
      />
    </Page>
  );
}
