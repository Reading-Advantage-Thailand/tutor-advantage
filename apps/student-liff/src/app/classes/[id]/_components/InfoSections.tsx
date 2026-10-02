import { CheckCircle2, Star, Users } from "lucide-react";
import { IconTile, ListGroup, ListRow, ProgressBar, SectionHeader, Surface, UserAvatar } from "@/components/mobile";
import { getSeatInfo } from "@/lib/classAccess";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ClassDetail } from "./types";

/** Tutor photo/initials, rating, student count and bio (generated when the tutor has none). */
export function TutorSection({ cls }: { cls: ClassDetail }) {
  const { tutor } = cls;
  const bio =
    tutor.bio ||
    `${t("classes.detail.tutorBioPrefix")} ${tutor.name} ${t("classes.detail.tutorBioWithContent")} ${cls.book}${
      cls.seriesName ? ` ${t("classes.detail.tutorBioSeriesPrefix")} ${cls.seriesName}` : ""
    }`;

  return (
    <section>
      <SectionHeader as="h3" title={t("classes.detail.tutorTitle")} />
      <Surface className="mt-1">
        <div className="flex items-center gap-3">
          <UserAvatar src={tutor.pictureUrl} name={tutor.name} size="lg" decorative />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base leading-[1.5] font-bold text-fg">{tutor.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] leading-[1.5] text-fg-muted">
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
        <p className="mt-3 text-sm leading-[1.6] text-fg-muted">{bio}</p>
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
        <div className="flex items-baseline justify-between gap-3 text-sm leading-[1.5]">
          <span className="text-fg-muted">
            {cls.students} {t("classes.detail.from")} {cls.maxStudents} {t("classes.detail.peopleUnit")}
          </span>
          <span className={cn("font-bold", urgent ? "text-danger-fg" : "text-brand-fg")}>
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

/** "What you get" list (server highlights, or the generic ones). */
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
      <ListGroup className="mt-1">
        {highlights.map((highlight, index) => (
          <ListRow
            key={index}
            leading={<IconTile icon={CheckCircle2} tone="brand" size="sm" />}
            title={<span className="font-medium">{highlight}</span>}
          />
        ))}
      </ListGroup>
    </section>
  );
}
