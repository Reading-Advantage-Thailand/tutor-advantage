import { BadgePercent, BookOpen, CalendarClock, MessageSquareText, Siren, Users } from "lucide-react";
import { Chip, IconTile } from "@/components/app";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { ClaimButton } from "./claim-button";

/** One open transfer request from GET /v1/classes/auction. */
export type AuctionItem = {
  id: string;
  title?: string;
  subject?: string;
  students?: number;
  networkBonusRate?: number;
  reason?: string;
  expiresAt?: string | null;
};

/**
 * Claimable classes (patterns.md T2 list language at card size): each card
 * is a container (rim, no ledge) with the class, an urgency chip, the facts
 * in a well, the bonus and the reason, and a tonal claim button: a row
 * action, so the screen never has more than one primary. Server-compatible.
 */
export function AuctionList({ auctions }: { auctions: AuctionItem[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-2">
      {auctions.map((cls) => (
        <li key={cls.id} className="ds-card flex min-w-0 flex-col">
          {/* Phones: the urgency chip goes under the title so long Thai titles keep the width. */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 px-4 pt-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] md:px-5 md:pt-5">
            <IconTile icon={BookOpen} tone="amber" className="row-span-2 sm:row-span-1" />
            <div className="min-w-0">
              <h2 className="type-card text-balance-th break-words text-fg">{cls.title}</h2>
              {cls.subject ? (
                <p className="mt-0.5 type-body-s break-words text-fg-muted">
                  {t("tutorClass.auction.subjectLabel")} <span className="text-fg">{cls.subject}</span>
                </p>
              ) : null}
            </div>
            <Chip tone="danger" icon={Siren} className="col-start-2 mt-2 justify-self-start sm:col-start-3 sm:row-start-1 sm:mt-0.5">
              {t("tutorClass.auction.urgent")}
            </Chip>
          </div>

          <ul className="ds-well mx-4 mt-3 flex flex-col gap-1.5 px-3.5 py-3 type-body-s text-fg-muted md:mx-5">
            <li className="flex min-w-0 items-start gap-2">
              <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
              <span className="min-w-0">
                {t("tutorClass.auction.expiresLabel")}{" "}
                <span className="font-medium text-fg">
                  {cls.expiresAt ? formatThaiDate(cls.expiresAt) : t("tutorClass.auction.noExpiry")}
                </span>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Users aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
              <span className="font-medium text-fg tabular">
                {cls.students} {t("tutorClass.classes.peopleUnit")}
              </span>
            </li>
            <li className="flex min-w-0 items-start gap-2">
              <MessageSquareText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
              <span className="min-w-0 break-words">
                {t("tutorClass.auction.reasonLabel")} <span className="text-fg">{cls.reason}</span>
              </span>
            </li>
          </ul>

          <div className="mt-auto flex flex-col gap-3 px-4 pt-3 pb-4 sm:flex-row sm:items-center sm:justify-between md:px-5 md:pb-5">
            <p className="flex min-w-0 items-start gap-2 type-label text-brand-fg">
              <BadgePercent aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                {t("tutorClass.auction.bonusPrefix")} <span className="font-semibold tabular">{cls.networkBonusRate}%</span>
              </span>
            </p>
            <ClaimButton transferId={cls.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}
