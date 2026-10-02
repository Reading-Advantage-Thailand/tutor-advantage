import Link from "next/link";
import { CalendarClock, CreditCard, Play, Video } from "lucide-react";
import { Chip, IconTile, ProgressBar } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import { buildEnrollmentHref, hasNextSession, type Enrollment } from "@/lib/enrollmentStatus";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { NextUpKind } from "./dashboardModel";

/** Self-study continues on the Progress tab (current lesson + "เรียนต่อ"). */
const CONTINUE_HREF = "/progress";

const cardClass =
  "rounded-[var(--radius-card)] border bg-surface p-4 shadow-[var(--shadow-card)]";

export interface NextUpCardProps {
  enrollment: Enrollment;
  kind: NextUpKind;
  /** Live class that still waits for payment: the CTA goes to checkout. */
  needsPayment: boolean;
}

/**
 * Home's one primary action. Live → big "เข้าห้องเรียนเลย" (the class lobby,
 * or checkout when unpaid). Otherwise → the next session and "ทำบทเรียนต่อ".
 */
export function NextUpCard({ enrollment, kind, needsPayment }: NextUpCardProps) {
  const tutorLine = `${t("dashboard.tutorPrefix")} ${enrollment.tutorName}`;

  if (kind === "live") {
    return (
      <section aria-labelledby="next-up-live" className={cn(cardClass, "border-danger-border")}>
        <Chip tone="danger" size="md" dot>
          {t("dashboard.liveNow")}
        </Chip>
        <h2 id="next-up-live" className="mt-3 line-clamp-2 text-lg leading-[1.45] font-bold text-fg">
          {enrollment.name}
        </h2>
        <p className="mt-0.5 truncate text-sm leading-[1.5] text-fg-muted">{tutorLine}</p>
        <Link
          href={buildEnrollmentHref(enrollment)}
          className={cn(buttonVariants({ variant: needsPayment ? "warning" : "brand", size: "cta" }), "mt-4 w-full")}
        >
          {needsPayment ? <CreditCard aria-hidden="true" /> : <Video aria-hidden="true" />}
          {needsPayment ? t("dashboard.pendingPaymentCta") : t("dashboard.joinLiveCta")}
        </Link>
      </section>
    );
  }

  const progress = Math.round(enrollment.progress || 0);

  return (
    <section aria-labelledby="next-up-session" className={cn(cardClass, "border-hairline")}>
      <div className="flex items-center gap-3">
        <IconTile icon={CalendarClock} tone="brand" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-[1.5] font-medium text-fg-muted">{t("dashboard.nextLesson")}</p>
          <h2 id="next-up-session" className="line-clamp-2 text-base leading-[1.5] font-bold text-fg">
            {hasNextSession(enrollment) ? enrollment.nextSession : t("dashboard.noNextSession")}
          </h2>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-app p-3">
        <p className="line-clamp-2 text-[15px] leading-[1.5] font-semibold text-fg">{enrollment.name}</p>
        <p className="truncate text-[13px] leading-[1.5] text-fg-muted">{tutorLine}</p>
        <div className="mt-2.5 flex items-center gap-3">
          <ProgressBar value={progress} size="sm" label={t("dashboard.progressLabel")} className="flex-1" />
          <span className="shrink-0 text-[13px] leading-[1.5] font-semibold text-brand-fg tabular-nums">
            {t("dashboard.progressLabel")} {progress}%
          </span>
        </div>
      </div>

      <Link href={CONTINUE_HREF} className={cn(buttonVariants({ variant: "brand", size: "cta" }), "mt-4 w-full")}>
        <Play aria-hidden="true" />
        {t("dashboard.continueCta")}
      </Link>
    </section>
  );
}
