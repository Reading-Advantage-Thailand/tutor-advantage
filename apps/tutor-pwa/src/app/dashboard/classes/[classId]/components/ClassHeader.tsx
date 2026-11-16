import Link from "next/link";
import { BookOpen, CalendarDays, ChevronLeft, Presentation, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Chip, IconTile, LevelChip, ShellTitle, levelIconClass, levelTone } from "@/components/app";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LinkButton } from "./LinkButton";

/**
 * Class header card (patterns.md T3): the class's CEFR band as a leading
 * edge and tile, the title (the page's h1, Kodchasan), the book, the status /
 * level / seats chips and the schedule line. Desktop puts the start action at
 * the right; phones get the lesson picker's sticky bar instead. Registers the
 * phone app-bar title and back target. Server-compatible.
 */
export function ClassHeader({
  classId,
  name,
  book,
  level,
  schedule,
  status,
  seats,
}: {
  classId: string;
  name: string;
  book?: string | null;
  level?: string | null;
  schedule?: string | null;
  /** The status chip/menu (ClassStatusToggle). */
  status: ReactNode;
  seats: { students: number; max: number };
}) {
  const tone = levelTone(level);
  return (
    <header className="flex min-w-0 flex-col gap-3">
      <ShellTitle title={t("tutorClass.view.appBarTitle")} backHref="/dashboard/classes" />
      <Link
        href="/dashboard/classes"
        // From 768px in px, where the app bar (and its back arrow) goes away.
        className="hidden min-h-8 items-center gap-1 self-start rounded-(--radius-ctl-sm) text-sm font-medium text-fg-muted hover:text-fg min-[768px]:inline-flex pointer-coarse:min-h-11"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        {t("tutorClass.classes.title")}
      </Link>

      <div className="ds-card relative min-w-0 overflow-hidden">
        {/* CEFR band on the leading edge (decorative; the level chip carries the word). */}
        <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1 bg-current", levelIconClass[tone])} />
        <div className="flex min-w-0 flex-col gap-4 py-4 pr-4 pl-5 md:flex-row md:items-start md:gap-6 md:py-6 md:pr-6 md:pl-7">
          <div className="flex min-w-0 flex-1 items-start gap-3 md:gap-4">
            <IconTile icon={BookOpen} tone={tone} size="lg" className="md:size-14 md:rounded-2xl md:[&_svg]:size-7" />
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-[1.3125rem] leading-[1.4] font-semibold break-words text-fg text-balance-th md:text-[1.75rem] md:leading-[1.3]">
                {name}
              </h1>
              {book ? <p className="mt-0.5 text-sm leading-[1.55] text-fg-muted md:text-[0.9375rem]">{book}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {status}
                {level ? <LevelChip level={level} /> : null}
                <Chip icon={Users} tone="neutral" className="tabular">
                  {seats.students}/{seats.max} {t("tutorClass.classes.peopleUnit")}
                </Chip>
              </div>
            </div>
          </div>
          <LinkButton href={`/lesson/${classId}`} variant="outline" size="lg" className="max-lg:hidden">
            <Presentation aria-hidden="true" className="size-5" />
            {t("tutorClass.view.startTeaching")}
          </LinkButton>
        </div>
        <p className="flex min-w-0 items-start gap-2 border-t border-hairline py-3 pr-4 pl-5 text-sm leading-[1.6] text-fg-muted md:pr-6 md:pl-7">
          <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-icon-purple" />
          <span className="min-w-0 break-words">
            <span className="sr-only">{t("tutorClass.classes.scheduleLabel")}: </span>
            {schedule || t("tutorClass.classes.notSet")}
          </span>
        </p>
      </div>
    </header>
  );
}
