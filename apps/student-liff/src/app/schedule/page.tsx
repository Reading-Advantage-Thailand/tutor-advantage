"use client";

import { AppBar, ErrorState, Screen } from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { LiffErrorState } from "@/app/dashboard/_components/LiffErrorState";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
import { enrolledClassesResourceKey, type EnrolledClassesResponse, type ScheduleClass } from "@/lib/schedule";
import { ScheduleSkeleton } from "./_components/ScheduleSkeleton";
import { ScheduleView } from "./_components/ScheduleView";

const NO_CLASSES: ScheduleClass[] = [];

export default function SchedulePage() {
  const { isReady, profile, error: liffError } = useLiff();
  const userId = profile?.userId;
  // Waits for LIFF start-up (the session cookie) before GET /classes, so a cold
  // deep link no longer fetches before the session exists.
  const { data, error, isLoading, isValidating, refetch } = useCachedResource<EnrolledClassesResponse>(
    userId ? enrolledClassesResourceKey(userId) : null,
    () => studentApi.getEnrolledClasses(),
    { enabled: isReady },
  );

  if (!isReady || isLoading) return <ScheduleSkeleton />;

  if (liffError || !profile) {
    return (
      <Screen>
        <AppBar title={t("schedule.title")} back fallbackHref="/dashboard" />
        <LiffErrorState />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <AppBar title={t("schedule.title")} back fallbackHref="/dashboard" />
        <ErrorState description={t("schedule.loadFailed")} onRetry={() => void refetch()} retrying={isValidating} />
      </Screen>
    );
  }

  return <ScheduleView classes={data?.classes ?? NO_CLASSES} />;
}
