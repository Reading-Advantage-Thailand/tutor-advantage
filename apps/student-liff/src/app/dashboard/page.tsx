"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { EmptyState, ErrorState, Screen } from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { buttonVariants } from "@/components/ui/button";
import { useCachedResource } from "@/lib/cachedResource";
import type { DashboardSummary } from "@/lib/enrollmentStatus";
import { t } from "@/lib/i18n";
import { dashboardResourceKey, fetchDashboardSummary } from "@/lib/resourceKeys";
import { DashboardHero } from "./_components/DashboardHero";
import { DashboardSkeleton } from "./_components/DashboardSkeleton";
import { deriveHomeModel, getReedyLine } from "./_components/dashboardModel";
import { InviteFriendCard } from "./_components/InviteFriendCard";
import { LiffErrorState } from "./_components/LiffErrorState";
import { MyClasses } from "./_components/MyClasses";
import { NextUpCard } from "./_components/NextUpCard";
import { PendingPaymentNotice } from "./_components/PendingPaymentNotice";
import { QuickActions } from "./_components/QuickActions";
import { TodayHistory } from "./_components/TodayHistory";
import { useUnreadChime } from "./_components/useUnreadChime";

/**
 * The content column overlaps the hero's rounded bottom by 30px, below Reedy.
 */
const overlapClass = "relative z-[3] -mt-[30px] flex flex-col gap-[22px] px-4 pb-6";

export default function DashboardPage() {
  const { isReady, profile, error: liffError } = useLiff();
  const resourceKey = profile ? dashboardResourceKey(profile.userId) : null;
  const { data, error, isLoading, isValidating, refetch } = useCachedResource<DashboardSummary>(
    resourceKey,
    fetchDashboardSummary,
    { enabled: isReady },
  );
  useUnreadChime(resourceKey, data ? (data.unreadMessages ?? 0) : undefined);
  const model = useMemo(() => deriveHomeModel(data), [data]);

  if (!isReady) return <DashboardSkeleton />;

  if (!profile) {
    return (
      <Screen>
        <LiffErrorState className="flex-1 justify-center" />
      </Screen>
    );
  }

  const name = profile.displayName || t("dashboard.defaultName");
  const heroProps = {
    name,
    pictureUrl: profile.pictureUrl,
    levelLabel: model.levelLabel,
    weekStreak: model.weekStreak,
    chipsLoading: isLoading,
  };

  if (isLoading) return <DashboardSkeleton hero={<DashboardHero {...heroProps} reedy="loading" />} />;

  if (error && !data) {
    return (
      <Screen>
        {/* No Reedy in the hero: the error card carries the one Reedy (oops). */}
        <DashboardHero {...heroProps} reedy={null} />
        <div className={overlapClass}>
          {liffError ? (
            // Start-up (session exchange) failed and the data call failed too: fix the login first.
            <LiffErrorState card />
          ) : (
            <ErrorState card onRetry={() => void refetch()} retrying={isValidating} />
          )}
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <DashboardHero {...heroProps} reedy={getReedyLine(model)} />
      <div className={overlapClass}>
        {model.primary && model.nextUpKind === "live" ? (
          <NextUpCard enrollment={model.primary} kind="live" needsPayment={model.primaryNeedsPayment} />
        ) : null}

        <PendingPaymentNotice pending={model.pendingNotice} />

        {model.primary && model.nextUpKind === "upcoming" ? (
          <NextUpCard enrollment={model.primary} kind="upcoming" needsPayment={false} />
        ) : null}

        {model.isEmpty ? (
          <EmptyState
            card
            icon={Sparkles}
            mascot="calm"
            title={t("dashboard.noClasses")}
            description={t("dashboard.noClassesSub")}
            action={
              <Link href="/classes" className={buttonVariants({ variant: "brand", size: "cta" })}>
                {t("dashboard.findClass")}
              </Link>
            }
          />
        ) : null}

        <QuickActions unread={model.unread} />

        {model.myClasses.length > 0 ? <MyClasses classes={model.myClasses} count={model.classCount} /> : null}

        <InviteFriendCard shareable={model.shareable} />

        <TodayHistory items={model.todayHistory} />
      </div>
    </Screen>
  );
}
