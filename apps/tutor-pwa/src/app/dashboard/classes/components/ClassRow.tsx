import Link from "next/link";
import { BookOpen, CalendarDays, ChevronRight, Settings2, Users } from "lucide-react";
import { Chip, IconTile, ListRow, levelTone, type TileTone } from "@/components/app";
import { buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { keepThaiWords } from "@/lib/thaiText";
import { classSetupHref } from "@/lib/tutorClassFlow";
import { cn } from "@/lib/utils";
import { classStatusInfo } from "./class-status";
import { DeleteClassButton } from "./DeleteClassButton";

export type ClassListItem = {
  id: string;
  name: string;
  book?: string;
  status?: string;
  students?: number;
  maxStudents?: number;
  nextSession?: string;
  /** CEFR band of the class's book series ("A0"), from GET /v1/classes. Colours the tile. */
  cefrLevel?: string | null;
  /** Admin-created class the tutor still has to set up. */
  setupRequired?: boolean;
};

/** Tile tone for a class: its CEFR band (components.md §5), neutral once closed. */
export function classTileTone(cls: Pick<ClassListItem, "status" | "cefrLevel">): TileTone {
  if (cls.status === "closed") return "neutral";
  const tone = levelTone(cls.cefrLevel);
  return tone === "neutral" ? "brand" : tone;
}

/** "4/30 คน" (tabular). */
export function seatsLabel(cls: Pick<ClassListItem, "students" | "maxStudents">) {
  return `${cls.students ?? 0}/${cls.maxStudents ?? 0} ${t("tutorClass.classes.peopleUnit")}`;
}

/** Tonal link-button to the admin-created class's setup form (sits above the stretched row link). */
export function ClassSetupLink({ classId, className }: { classId: string; className?: string }) {
  return (
    <Link href={classSetupHref(classId)} className={cn(buttonVariants({ variant: "tonal", size: "sm" }), className)}>
      <Settings2 aria-hidden="true" />
      {t("tutorClass.setup.cardAction")}
    </Link>
  );
}

/** Enrolment status = colour + dot + word (components.md §4). */
export function ClassStatusChip({ status }: { status?: string }) {
  const info = classStatusInfo(status);
  return (
    <Chip tone={info.tone} dot>
      {info.label}
    </Chip>
  );
}

/** "รอตั้งค่า": admin-created class waiting for the tutor (colour + icon + word). */
export function SetupPendingChip() {
  return (
    <Chip tone="warning" icon={Settings2}>
      {t("tutorClass.setup.pendingChip")}
    </Chip>
  );
}

/**
 * One class in the phone/tablet list (patterns.md T2, S4 rows at tutor
 * sizes): the shared ListRow with its CEFR tile, the name as a stretched link
 * over the whole row, the book, seats and schedule lines (the schedule wraps,
 * it is never cut), a status chip, the "รอตั้งค่า" chip and a chevron. Only
 * the setup link and the DEV delete button go in the row's `actions`, above
 * the stretched link, so no interactive element is nested in another; the
 * chips are plain text in `meta`, under the link, so a tap on one opens the
 * class. Flat row: the card around the list is the container.
 */
export function ClassRow({ cls, showDevDelete }: { cls: ClassListItem; showDevDelete?: boolean }) {
  const hasActions = Boolean(cls.setupRequired || showDevDelete);
  return (
    <ListRow
      as="li"
      titleAs="h3"
      href={`/dashboard/classes/${cls.id}`}
      align="start"
      lines="none"
      leading={<IconTile icon={BookOpen} tone={classTileTone(cls)} className="mt-0.5" />}
      title={cls.name}
      subtitle={cls.book ? <span className="block truncate">{cls.book}</span> : undefined}
      meta={
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 type-body-s text-fg-muted">
          <ClassStatusChip status={cls.status} />
          {cls.setupRequired ? <SetupPendingChip /> : null}
          <span className="inline-flex items-center gap-1.5 tabular">
            <Users aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
            {seatsLabel(cls)}
          </span>
          {cls.nextSession ? (
            <span className="inline-flex min-w-0 max-w-full items-start gap-1.5">
              <CalendarDays aria-hidden="true" className="mt-[0.2em] size-4 shrink-0 text-fg-subtle" />
              <span className="min-w-0 break-words">{keepThaiWords(cls.nextSession)}</span>
            </span>
          ) : null}
        </span>
      }
      actions={
        hasActions ? (
          <>
            {cls.setupRequired ? <ClassSetupLink classId={cls.id} /> : null}
            {showDevDelete ? <DeleteClassButton classId={cls.id} className={cls.name} /> : null}
          </>
        ) : undefined
      }
      chevron={false}
      // Decorative, as on the old card: the row link carries the name. "จัดการคลาส" from sm up, unless the row has its setup action.
      trailing={
        <span aria-hidden="true" className={cn("flex items-center gap-1 text-fg-subtle", !cls.setupRequired && "sm:text-brand-fg")}>
          {cls.setupRequired ? null : (
            <span className="hidden type-body-s font-medium whitespace-nowrap sm:inline">{t("tutorClass.classes.manage")}</span>
          )}
          <ChevronRight className="size-4 shrink-0" />
        </span>
      }
    />
  );
}
