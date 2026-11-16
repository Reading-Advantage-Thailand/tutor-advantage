import { CheckCircle2, Star, Users } from "lucide-react";
import { IconTile, ProgressBar, SectionHeader, Surface, UserAvatar } from "@/components/mobile";
import { getSeatInfo } from "@/lib/classAccess";
import { NBSP } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ClassDetail } from "./types";

/** Tutor photo/initials, rating, student count and bio (generated when the tutor has none). */
export function TutorSection({ cls }: { cls: ClassDetail }) {
  const { tutor } = cls;
  // No bio from the tutor: a generated line. Its label "จากชุด" stays whole and travels with the
  // series name (no-break space), so the name never sits alone on the last line. The tutor's own
  // bio and the names are data and are shown as they are.
  const bio = tutor.bio || (
    <>
      {`${t("classes.detail.tutorBioPrefix")} ${tutor.name} ${t("classes.detail.tutorBioWithContent")} ${cls.book}`}
      {cls.seriesName ? (
        <>
          {" "}
          <span className="whitespace-nowrap">{t("classes.detail.tutorBioSeriesPrefix")}</span>
          {NBSP}
          {cls.seriesName}
        </>
      ) : null}
    </>
  );

  return (
    <section>
      <SectionHeader as="h3" title={t("classes.detail.tutorTitle")} />
      <Surface className="mt-1" padding="lg">
        <div className="flex items-center gap-3.5">
          <UserAvatar src={tutor.pictureUrl} name={tutor.name} size="lg" decorative />
          <div className="min-w-0 flex-1">
            <p className="t-title-s truncate text-fg">{tutor.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm leading-[1.6] text-fg-muted tabular-nums">
              {typeof tutor.rating === "number" ? (
                <span className="inline-flex items-center gap-1">
                  <Star aria-hidden="true" className="size-3.5 fill-warning-solid text-warning-solid" />
                  {tutor.rating.toFixed(1)}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Users aria-hidden="true" className="size-3.5" />
                {tutor.students || 0} {t("classes.detail.studentsUnit")}
              </span>
            </p>
          </div>
        </div>
        <p className="well mt-4 px-3.5 py-3 text-sm leading-[1.65] text-fg-muted">{bio}</p>
      </Surface>
    </section>
  );
}

/** Seats meter for the sales layout. */
export function SeatsSection({ cls }: { cls: ClassDetail }) {
  const { seatsLeft, fillPercent, urgent } = getSeatInfo(cls.students, cls.maxStudents);
  return (
    <section>
      <SectionHeader as="h3" title={t("classes.detail.seats")} />
      <Surface className="mt-1">
        <div className="flex items-baseline justify-between gap-3 text-sm leading-[1.6] tabular-nums">
          <span className="text-fg-muted">
            {cls.students} {t("classes.detail.from")} {cls.maxStudents} {t("classes.detail.peopleUnit")}
          </span>
          <span className={cn("font-semibold", urgent ? "text-danger-fg" : "text-brand-fg")}>
            {t("classes.detail.remainingPrefix")} {seatsLeft} {t("classes.detail.seatsLeftSuffix")}
          </span>
        </div>
        <ProgressBar
          value={fillPercent}
          tone={urgent ? "warning" : "brand"}
          label={t("classes.detail.seats")}
          className="mt-2.5"
        />
      </Surface>
    </section>
  );
}

/** "What you get" list (server highlights, or the generic ones): body text 16/1.65 beside a check tile. */
export function BenefitsSection({ cls }: { cls: ClassDetail }) {
  const fallbackHighlights = [
    t("classes.detail.highlightSystem"),
    cls.totalHours
      ? `${t("classes.detail.liveHoursPrefix")} ${cls.totalHours} ${t("classes.detail.hourUnit")}`
      : t("classes.detail.liveBySchedule"),
    t("classes.detail.appAccess"),
    t("classes.detail.parentReport"),
  ];
  const highlights = cls.highlights?.length ? cls.highlights : fallbackHighlights;

  return (
    <section>
      <SectionHeader as="h3" title={t("classes.detail.benefits")} />
      <Surface className="mt-1" padding="none">
        <ul>
          {highlights.map((highlight, index) => (
            <li key={index} className="list-row flex items-start gap-3.5 px-4 py-3" data-leading="">
              <IconTile icon={CheckCircle2} tone="brand" size="sm" />
              <span className="t-body min-w-0 flex-1 self-center text-fg">{highlight}</span>
            </li>
          ))}
        </ul>
      </Surface>
    </section>
  );
}
