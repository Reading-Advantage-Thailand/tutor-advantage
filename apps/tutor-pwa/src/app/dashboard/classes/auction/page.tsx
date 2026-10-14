import Link from "next/link";
import { cookies } from "next/headers";
import { BookOpen, CalendarClock, Megaphone, Users } from "lucide-react";
import { Chip, EmptyState, IconTile, Page, PageHeader, Surface } from "@/components/app";
import { formatThaiDate } from "@/lib/format";
import { LEARNING_URL } from "@/lib/service-urls";
import { t } from "@/lib/i18n";
import { ClaimButton } from "./claim-button";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function getAuctions() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) return [];

  try {
    const res = await fetch(`${LEARNING_URL}/v1/classes/auction`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: { tags: ["auctions"] },
    });

    if (!res.ok) return [];

    const data = await res.json();
    return data.auctions || [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export default async function AuctionPage() {
  const abandonedClasses: any[] = await getAuctions();

  return (
    <Page width="medium">
      <PageHeader
        title={t("tutorClass.auction.title")}
        description={t("tutorClass.auction.subtitle")}
        backHref="/dashboard/classes"
        backLabel={t("tutorClass.classes.title")}
      />

      {abandonedClasses.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          tone="amber"
          title={t("tutorClass.auction.empty")}
          description={t("tutorClass.ui.auctionEmptyDescription")}
          action={
            <Link
              href="/dashboard/classes"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-field-border bg-surface px-3.5 text-sm font-semibold text-fg outline-none hover:bg-surface-muted focus-visible:ring-3 focus-visible:ring-ring/40 dark:border-hairline-strong"
            >
              {t("tutorClass.auction.back")}
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {abandonedClasses.map((cls) => (
            <Surface as="li" key={cls.id} padding="none" className="flex flex-col md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3 p-4 md:p-5">
                <IconTile icon={BookOpen} tone="amber" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 text-[0.9375rem] font-semibold break-words text-fg">{cls.title}</h2>
                    <Chip tone="danger" size="sm">{t("tutorClass.auction.urgent")}</Chip>
                  </div>
                  {cls.subject ? (
                    <p className="mt-0.5 truncate text-[0.8125rem] text-fg-muted">
                      {t("tutorClass.auction.subjectLabel")} <span className="text-fg">{cls.subject}</span>
                    </p>
                  ) : null}
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-fg-muted">
                    <li className="flex items-center gap-1.5">
                      <CalendarClock aria-hidden="true" className="size-4 text-fg-subtle" />
                      {t("tutorClass.auction.expiresLabel")}{" "}
                      {cls.expiresAt ? formatThaiDate(cls.expiresAt) : t("tutorClass.auction.noExpiry")}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Users aria-hidden="true" className="size-4 text-fg-subtle" />
                      {cls.students} {t("tutorClass.classes.peopleUnit")}
                    </li>
                  </ul>
                  <p className="mt-2 text-[0.8125rem] text-warning-fg">
                    {t("tutorClass.auction.bonusPrefix")} {cls.networkBonusRate}% · {t("tutorClass.auction.reasonLabel")} {cls.reason}
                  </p>
                </div>
              </div>
              <div className="border-t border-hairline px-4 py-3 md:border-t-0 md:border-l md:px-5">
                <ClaimButton transferId={cls.id} />
              </div>
            </Surface>
          ))}
        </ul>
      )}
    </Page>
  );
}
