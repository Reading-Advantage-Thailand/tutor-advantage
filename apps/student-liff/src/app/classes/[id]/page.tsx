"use client";

import { use, useState } from "react";
import Link from "next/link";
import { DoorOpen, SearchX } from "lucide-react";
import { toast } from "sonner";
import AssessmentPanel from "@/components/AssessmentPanel";
import { BottomActionBar, ErrorState, Notice, Screen, StatusScreen } from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { buttonVariants } from "@/components/ui/button";
import { useCachedResource } from "@/lib/cachedResource";
import {
  classArticlesResourceKey,
  classDetailResourceKey,
  classReviewResourceKey,
  classifyClassLoadError,
  deriveClassAccess,
  getClassPrimaryAction,
  resolveSelectedCycleId,
  type ClassPrimaryAction,
} from "@/lib/classAccess";
import { formatTHB } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LiffStartupError } from "../_components/LiffStartupError";
import { ClassDetailAppBar, ClassDetailSkeleton } from "./_components/ClassDetailSkeleton";
import { ClassHero } from "./_components/ClassHero";
import { BenefitsSection, SeatsSection, TutorSection } from "./_components/InfoSections";
import { CoursePreviewSection, LessonsSection, type ArticlesState } from "./_components/Lessons";
import { ReviewCard } from "./_components/ReviewCard";
import { CalendarSheet, NextSessionCard, ScheduleSection } from "./_components/ScheduleSections";
import { fetchClassArticles, fetchClassDetail, fetchClassReview } from "./_components/classDetailData";
import type { ClassArticleDetail, ClassDetail, TutorReview } from "./_components/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

function PriceBlock({ label, price }: { label: string; price: number }) {
  return (
    <div className="min-w-0 shrink-0">
      <p className="text-xs leading-[1.5] text-fg-muted">{label}</p>
      <p className="text-xl leading-[1.3] font-extrabold text-fg tabular-nums">
        {price === 0 ? t("classes.free") : formatTHB(price)}
      </p>
    </div>
  );
}

/** Bottom bar: upgrade (price + next book) · enter the class · enroll (price + CTA). */
function PrimaryActionBar({ action }: { action: ClassPrimaryAction }) {
  const cta = cn(buttonVariants({ variant: "brand", size: "cta" }), "min-w-0 flex-1");
  if (action.kind === "upgrade") {
    return (
      <BottomActionBar>
        <PriceBlock label={t("classes.detail.upgradePriceLabel")} price={action.price} />
        <Link href={action.href} id="btn-upgrade-class" className={cta}>
          {`${t("classes.detail.upgradeNextBookPrefix")} ${action.cycleSequence}`}
        </Link>
      </BottomActionBar>
    );
  }
  if (action.kind === "enter") {
    return (
      <BottomActionBar>
        <Link href={action.href} id="btn-enter-class" className={cta}>
          <DoorOpen aria-hidden="true" />
          {t("classes.detail.enterClass")}
        </Link>
      </BottomActionBar>
    );
  }
  return (
    <BottomActionBar>
      <PriceBlock label={t("classes.detail.priceLabel")} price={action.price} />
      <Link href={action.href} id="btn-enroll-class" className={cta}>
        {action.pendingPayment ? t("classes.detail.continuePayment") : t("classes.detail.enrollNow")}
      </Link>
    </BottomActionBar>
  );
}

export default function ClassDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { liff, isReady, error: liffError, profile } = useLiff();
  const userId = profile?.userId;
  const [userSelectedCycleId, setUserSelectedCycleId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const detail = useCachedResource<{ class: ClassDetail }>(
    userId && id ? classDetailResourceKey(userId, id) : null,
    () => fetchClassDetail(id),
    { enabled: isReady },
  );
  const cls = detail.data?.class ?? null;
  const selectedCycleId = cls ? resolveSelectedCycleId(cls, userSelectedCycleId) : "";
  const access = cls ? deriveClassAccess(cls, selectedCycleId) : null;

  // Lessons of the selected book; a locked book is never requested (as before).
  const articlesRequested = Boolean(cls && access && !access.selectedCycleLocked);
  const articlesResource = useCachedResource<ClassArticleDetail[]>(
    userId && articlesRequested ? classArticlesResourceKey(userId, id, selectedCycleId) : null,
    () => fetchClassArticles(id, selectedCycleId),
    { enabled: isReady },
  );
  const articles: ArticlesState = {
    data: articlesResource.data,
    error: articlesResource.error,
    isLoading: articlesResource.isLoading,
    isValidating: articlesResource.isValidating,
    refetch: () => void articlesResource.refetch(),
  };

  const reviewResource = useCachedResource<{ review: TutorReview | null }>(
    userId && access?.canReview ? classReviewResourceKey(userId, id) : null,
    () => fetchClassReview(id),
    { enabled: isReady },
  );

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/classes/${id}`;
    try {
      if (liff?.isInClient() && liff.isApiAvailable("shareTargetPicker")) {
        await liff.shareTargetPicker([{ type: "text", text: `${cls?.name ?? ""}\n${shareUrl}` }]);
      } else if (navigator.share) {
        await navigator.share({ title: cls?.name ?? "", url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t("classes.detail.shareSuccess"));
      }
    } catch (error) {
      // Closing the system share sheet is not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(t("classes.detail.shareFailed"));
    }
  };

  if (!isReady || detail.isLoading) return <ClassDetailSkeleton />;

  if (liffError || !profile) {
    return (
      <Screen>
        <ClassDetailAppBar />
        <LiffStartupError />
      </Screen>
    );
  }

  if (!cls || !access) {
    const kind = classifyClassLoadError(detail.error);
    return (
      <Screen>
        <ClassDetailAppBar />
        {kind === "notFound" ? (
          <StatusScreen
            icon={SearchX}
            tone="neutral"
            title={t("classes.detail.notFound")}
            description={t("classes.detail.notFoundDescription")}
            primaryAction={
              <Link href="/classes" className={buttonVariants({ variant: "brand", size: "cta" })}>
                {t("classes.detail.backToClasses")}
              </Link>
            }
          />
        ) : (
          <ErrorState
            title={t("classes.detail.loadErrorTitle")}
            kind={kind === "offline" ? "offline" : "error"}
            onRetry={() => void detail.refetch()}
            retrying={detail.isValidating}
          />
        )}
      </Screen>
    );
  }

  const primaryAction = getClassPrimaryAction(cls, access);
  const openCalendar = () => setCalendarOpen(true);

  return (
    <Screen>
      <ClassDetailAppBar onShare={handleShare} />

      <div className="flex flex-col gap-5 px-4 pt-2 pb-6">
        <ClassHero cls={cls} />

        {cls.isEnrolled ? (
          <>
            {access.canReview ? (
              <ReviewCard
                classId={id}
                review={reviewResource.data?.review ?? null}
                loading={reviewResource.isLoading}
                onSaved={(review) => reviewResource.mutate({ review })}
              />
            ) : null}

            {access.needsUpgrade && access.activeCycle ? (
              <Notice
                tone="warning"
                title={t("classes.detail.newBookTitle")}
                description={`${access.activeCycle.title} ${t("classes.detail.newBookDescriptionSuffix")}`}
              />
            ) : null}

            <NextSessionCard cls={cls} onAddToCalendar={openCalendar} />

            <LessonsSection
              cls={cls}
              access={access}
              selectedCycleId={selectedCycleId}
              onSelectCycle={setUserSelectedCycleId}
              articles={articles}
            />

            {selectedCycleId && access.canReadSelectedCycle ? (
              <AssessmentPanel key={selectedCycleId} cycleId={selectedCycleId} classId={id} />
            ) : null}

            <TutorSection cls={cls} />
          </>
        ) : (
          <>
            {cls.enrollmentStatus === "PENDING_PAYMENT" ? (
              <Notice
                tone="info"
                title={t("classes.detail.pendingPaymentTitle")}
                description={t("classes.detail.pendingPaymentDescription")}
              />
            ) : null}
            <TutorSection cls={cls} />
            <ScheduleSection cls={cls} onAddToCalendar={openCalendar} />
            <SeatsSection cls={cls} />
            <CoursePreviewSection cls={cls} articles={articles} articlesRequested={articlesRequested} />
            <BenefitsSection cls={cls} />
          </>
        )}
      </div>

      <PrimaryActionBar action={primaryAction} />
      <CalendarSheet cls={cls} liff={liff} open={calendarOpen} onOpenChange={setCalendarOpen} />
    </Screen>
  );
}
