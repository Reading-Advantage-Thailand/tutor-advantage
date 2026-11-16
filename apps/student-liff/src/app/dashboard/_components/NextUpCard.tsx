import Link from "next/link";
import { BookOpenText, CreditCard, Play, Video } from "lucide-react";
import { Chip, IconTile, ProgressBar } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import { keepTimesTogether, noOrphan } from "@/lib/format";
import { buildEnrollmentHref, hasNextSession, type Enrollment } from "@/lib/enrollmentStatus";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { NextUpKind } from "./dashboardModel";

/** Self-study continues on the Progress tab (current lesson + "เรียนต่อ"). */
const CONTINUE_HREF = "/progress";

/** A container card (rim + soft shadow, no ledge): only its button is tappable. */
const cardClass =
  "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface px-[18px] pt-[18px] pb-5 shadow-[var(--shadow-card)]";

export interface NextUpCardProps {
  enrollment: Enrollment;
  kind: NextUpKind;
  /** Live class that still waits for payment: the CTA goes to checkout. */
  needsPayment: boolean;
}

/** "เรียนไปแล้ว" + percentage (reading face, tabular) above the 12px bar. */
function ProgressRow({ progress }: { progress: number }) {
  return (
    <>
      <div className="mt-4 mb-2 flex items-baseline justify-between gap-3">
        <span className="t-body-s text-fg-muted">{t("dashboard.progressLabel")}</span>
        <span className="text-sm leading-[1.4] font-semibold text-brand-fg tabular-nums">{progress}%</span>
      </div>
      <ProgressBar value={progress} label={t("dashboard.progressLabel")} />
    </>
  );
}

/**
 * Home's one primary action (patterns.md S1.2): book tile, "คาบถัดไป · …",
 * the class name, the tutor, progress and the primary lg button. Live → the
 * live chip and "เข้าห้องเรียนเลย" (the class lobby, or checkout when unpaid).
 * Otherwise → "ทำบทเรียนต่อ".
 */
export function NextUpCard({ enrollment, kind, needsPayment }: NextUpCardProps) {
  const tutorLine = `${t("dashboard.tutorPrefix")} ${enrollment.tutorName}`;
  const progress = Math.round(enrollment.progress || 0);

  if (kind === "live") {
    return (
      <section aria-labelledby="next-up-live" className={cardClass}>
        <div className="flex items-center gap-3.5">
          <IconTile icon={BookOpenText} tone="brand" size="lg" />
          <div className="min-w-0 flex-1">
            <Chip tone="danger" size="sm" dot>
              {t("dashboard.liveNow")}
            </Chip>
            <h2 id="next-up-live" className="t-title-l mt-1 line-clamp-2 text-balance text-fg">
              {noOrphan(enrollment.name)}
            </h2>
            <p className="t-body-s truncate text-fg-muted">{tutorLine}</p>
          </div>
        </div>
        <ProgressRow progress={progress} />
        <Link
          href={buildEnrollmentHref(enrollment)}
          className={cn(buttonVariants({ variant: needsPayment ? "warning" : "brand", size: "cta-lg" }), "mt-[18px] w-full")}
        >
          {needsPayment ? <CreditCard aria-hidden="true" /> : <Video aria-hidden="true" />}
          {needsPayment ? t("dashboard.pendingPaymentCta") : t("dashboard.joinLiveCta")}
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="next-up-session" className={cardClass}>
      <div className="flex items-center gap-3.5">
        <IconTile icon={BookOpenText} tone="brand" size="lg" />
        <div className="min-w-0 flex-1">
          {/* Three lines: on a 320px phone a two-day schedule plus its time range needs a third
              line, and the time is the part of this line that must never be cut. */}
          <p className="t-body-s line-clamp-3 text-fg-muted">
            {t("dashboard.nextLesson")} · {hasNextSession(enrollment) ? keepTimesTogether(enrollment.nextSession) : t("dashboard.noNextSession")}
          </p>
          <h2 id="next-up-session" className="t-title-l line-clamp-2 text-balance text-fg">
            {noOrphan(enrollment.name)}
          </h2>
          <p className="t-body-s truncate text-fg-muted">{tutorLine}</p>
        </div>
      </div>
      <ProgressRow progress={progress} />
      <Link href={CONTINUE_HREF} className={cn(buttonVariants({ variant: "brand", size: "cta-lg" }), "mt-[18px] w-full")}>
        <Play aria-hidden="true" />
        {t("dashboard.continueCta")}
      </Link>
    </section>
  );
}
