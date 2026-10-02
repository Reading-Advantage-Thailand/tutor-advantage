import Link from "next/link";
import { BookOpen, CalendarDays, ChevronRight, Users } from "lucide-react";
import { Chip, IconTile, Surface } from "@/components/app";
import { t } from "@/lib/i18n";
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
};

/**
 * One class in the list. The title link stretches over the whole card
 * (::after overlay) so the optional DEV delete button can sit on top of it
 * without nesting interactive elements. Server component.
 */
export function ClassCard({ cls, showDevDelete }: { cls: ClassListItem; showDevDelete?: boolean }) {
  const status = classStatusInfo(cls.status);
  const muted = cls.status === "closed";
  return (
    <Surface as="li" padding="none" className="relative flex flex-col hover:border-hairline-strong focus-within:ring-3 focus-within:ring-ring/40">
      <div className="flex min-w-0 items-start gap-3 p-4 md:p-5">
        <IconTile icon={BookOpen} tone={muted ? "neutral" : "brand"} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <h3 className="min-w-0 text-[0.9375rem] font-semibold break-words text-fg">
              <Link
                href={`/dashboard/classes/${cls.id}`}
                className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
              >
                {cls.name}
              </Link>
            </h3>
            <Chip tone={status.tone} size="sm" className="shrink-0">
              {status.label}
            </Chip>
          </div>
          {cls.book ? <p className="mt-0.5 truncate text-[0.8125rem] text-fg-muted">{cls.book}</p> : null}
          <ul className="mt-3 flex flex-col gap-1.5 text-[0.8125rem] text-fg-muted">
            {cls.nextSession ? (
              <li className="flex min-w-0 items-start gap-2">
                <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                <span className="min-w-0 break-words">{cls.nextSession}</span>
              </li>
            ) : null}
            <li className="flex items-center gap-2">
              <Users aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
              <span className="tabular">
                {cls.students ?? 0}/{cls.maxStudents ?? 0} {t("tutorClass.classes.peopleUnit")}
              </span>
            </li>
          </ul>
        </div>
      </div>
      <div
        className={cn(
          "mt-auto flex items-center gap-2 border-t border-hairline px-4 py-2 md:px-5",
          showDevDelete ? "justify-between" : "justify-end",
        )}
      >
        {showDevDelete ? (
          <div className="relative z-10">
            <DeleteClassButton classId={cls.id} className={cls.name} />
          </div>
        ) : null}
        <span aria-hidden="true" className="flex items-center gap-1 text-[0.8125rem] font-medium text-brand-fg">
          {t("tutorClass.classes.manage")}
          <ChevronRight className="size-4" />
        </span>
      </div>
    </Surface>
  );
}
