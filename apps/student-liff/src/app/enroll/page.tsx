"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BarChart2, BookOpen, CalendarDays, CheckCircle2, Link2Off, Users } from "lucide-react";
import { toast } from "sonner";
import {
  BottomActionBar,
  Chip,
  ErrorState,
  IconTile,
  ListGroup,
  Notice,
  ProgressBar,
  Screen,
  StatusScreen,
  Surface,
  UserAvatar,
} from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import { studentApi } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { getLevelTone } from "@/lib/cefr";
import { classDetailResourceKey } from "@/lib/classAccess";
import { formatTHB, noOrphan } from "@/lib/format";
import { t, type I18nKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EnrollAppBar, EnrollSkeleton } from "./_components/EnrollSkeleton";
import { InfoRow } from "./_components/InfoRow";
import {
  buildEnrollLoginRedirect,
  buildEnrollPaymentHref,
  classifyEnrollError,
  getEnrollCtaKind,
  getEnrollSeatState,
  isRetryableEnrollLoadError,
  mapEnrollClassDetails,
  requestFreeEnrollment,
  type EnrollErrorKind,
} from "./_components/enrollFlow";

const ENROLL_ERROR_COPY: Record<EnrollErrorKind, I18nKey> = {
  classFull: "enroll.enrollErrors.classFull",
  classClosed: "enroll.enrollErrors.classClosed",
  linkInvalid: "enroll.enrollErrors.linkInvalid",
  demoExpired: "enroll.enrollErrors.demoExpired",
  notFound: "enroll.enrollErrors.notFound",
  ownClass: "enroll.enrollErrors.ownClass",
  generic: "enroll.enrollErrors.generic",
};

type EnrollDetailsResponse = { class: Parameters<typeof mapEnrollClassDetails>[0] };

function BrowseClassesLink({ variant = "brand" }: { variant?: "brand" | "brandSoft" }) {
  return (
    <Link href="/classes" className={buttonVariants({ variant, size: variant === "brand" ? "cta" : "touch" })}>
      {t("enroll.browseClasses")}
    </Link>
  );
}

function EnrollContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, isReady } = useLiff();

  const classId = searchParams.get("classId");
  const referralToken = searchParams.get("referralToken") ?? searchParams.get("token");

  const [enrolling, setEnrolling] = useState(false);
  // Synchronous double-submit guard (state updates are async).
  const enrollingRef = useRef(false);

  // classId wins over a referral token, as before. Requested only once the
  // student is signed in (a signed-out visitor is sent to /login first).
  const requestKey =
    profile && classId
      ? classDetailResourceKey(profile.userId, classId)
      : profile && referralToken
        ? `${profile.userId}:referral:${referralToken}`
        : null;
  const resource = useCachedResource<EnrollDetailsResponse>(
    requestKey,
    () => (classId ? studentApi.getClassDetails(classId) : studentApi.getReferralDetails(referralToken as string)),
    { enabled: isReady },
  );
  const classDetails = useMemo(() => (resource.data ? mapEnrollClassDetails(resource.data.class) : null), [resource.data]);

  useEffect(() => {
    if (isReady && !profile) {
      router.replace(buildEnrollLoginRedirect(searchParams.toString()));
    }
  }, [isReady, profile, router, searchParams]);

  const handleAction = async () => {
    if (!classDetails || enrollingRef.current) return;

    if (classDetails.price === 0) {
      enrollingRef.current = true;
      setEnrolling(true);
      try {
        const enrollment = await requestFreeEnrollment(studentApi, classDetails.classId, referralToken);
        if (enrollment.status === "ACTIVE") {
          // Home, Classes and Progress must show the new class right away.
          if (profile) invalidateResource(`${profile.userId}:`);
          router.replace("/dashboard");
          return;
        }
      } catch (err) {
        console.warn("Enrollment failed:", err);
        toast.error(t(ENROLL_ERROR_COPY[classifyEnrollError(err)]));
        enrollingRef.current = false;
        setEnrolling(false);
        return;
      }
    }

    enrollingRef.current = true;
    setEnrolling(true);
    router.push(buildEnrollPaymentHref(classDetails.classId, referralToken));
  };

  /* ── Start-up / sign-in / loading ── */
  if (!isReady) return <EnrollSkeleton label={t("enroll.loadingPreparing")} />;
  if (!profile) return <EnrollSkeleton label={t("enroll.redirectingLogin")} />;

  if (!classId && !referralToken) {
    return (
      <Screen>
        <EnrollAppBar />
        <StatusScreen
          icon={Link2Off}
          tone="neutral"
          title={t("enroll.missingTitle")}
          description={t("enroll.errors.missingClass")}
          primaryAction={<BrowseClassesLink />}
        />
      </Screen>
    );
  }

  if (resource.isLoading) return <EnrollSkeleton label={t("enroll.loadingClass")} />;

  if (!classDetails) {
    const kind = classifyEnrollError(resource.error);
    return (
      <Screen>
        <EnrollAppBar />
        {isRetryableEnrollLoadError(kind) ? (
          <ErrorState
            title={t("enroll.loadErrorTitle")}
            kind={resource.error instanceof TypeError ? "offline" : "error"}
            onRetry={() => void resource.refetch()}
            retrying={resource.isValidating}
          />
        ) : (
          <StatusScreen
            icon={Link2Off}
            tone="neutral"
            title={t("enroll.cannotEnrollTitle")}
            description={t(ENROLL_ERROR_COPY[kind])}
            primaryAction={<BrowseClassesLink />}
          />
        )}
      </Screen>
    );
  }

  /* ── Confirm step ── */
  const seats = getEnrollSeatState(classDetails.currentStudents, classDetails.maxStudents);
  const cta = getEnrollCtaKind(seats.isFull, classDetails.price);

  return (
    <Screen>
      <EnrollAppBar />

      <div className="flex flex-col gap-4 px-4 pt-2 pb-6">
        <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-hero p-5 text-hero-fg shadow-[var(--shadow-card)]">
          <span aria-hidden="true" className="pointer-events-none absolute -top-12 -right-10 size-36 rounded-full bg-hero-chip" />
          <Chip tone="onBrand" size="md" icon={CheckCircle2} className="relative">
            {t("enroll.confirmClass")}
          </Chip>
          <h2 className="relative mt-3 text-[22px] leading-[1.45] font-extrabold text-balance">{noOrphan(classDetails.className)}</h2>
          <div className="relative mt-3 flex flex-wrap gap-2">
            {classDetails.cefrLevel ? (
              <Chip tone="onBrand" size="md" icon={BarChart2}>
                {`${t("enroll.cefrChipPrefix")} ${classDetails.cefrLevel}`}
              </Chip>
            ) : null}
            <Chip tone="onBrand" size="md" icon={Users}>
              {`${classDetails.currentStudents}/${classDetails.maxStudents}`}
            </Chip>
          </div>
        </section>

        {seats.isFull ? (
          <Notice
            tone="warning"
            role="status"
            title={t("enroll.fallbackBannerTitle")}
            description={t("enroll.fallbackBannerDesc")}
            action={<BrowseClassesLink variant="brandSoft" />}
          />
        ) : null}

        <ListGroup aria-label={t("enroll.confirmClass")}>
          <InfoRow
            leading={<UserAvatar src={classDetails.tutorPictureUrl} name={classDetails.tutorName} decorative />}
            label={t("enroll.tutor")}
            value={classDetails.tutorName}
          />
          <InfoRow leading={<IconTile icon={BookOpen} />} label={t("enroll.book")} value={classDetails.bookTitle} />
          <InfoRow
            leading={<IconTile icon={BarChart2} tone={getLevelTone(classDetails.cefrLevel)} />}
            label={t("enroll.level")}
            value={classDetails.cefrLevel}
          />
          <InfoRow
            leading={<IconTile icon={CalendarDays} tone="purple" />}
            label={t("enroll.schedule")}
            value={classDetails.schedule}
          />
        </ListGroup>

        <Surface>
          <div className="flex items-baseline justify-between gap-3 text-sm leading-[1.5]">
            <span className="text-fg-muted">{t("enroll.students")}</span>
            <span className="font-bold text-fg tabular-nums">
              {classDetails.currentStudents}/{classDetails.maxStudents}{" "}
              <span className="font-normal text-fg-muted">{t("enroll.peopleUnit")}</span>
            </span>
          </div>
          <ProgressBar
            value={seats.spotsPercent}
            tone={seats.busy ? "warning" : "brand"}
            label={t("enroll.students")}
            className="mt-2.5"
          />
          {seats.urgent ? (
            <p className="mt-2 text-[13px] leading-[1.5] font-semibold text-danger-fg">
              {t("enroll.urgentSeatsPrefix")} {seats.spotsLeft} {t("enroll.urgentSeatsSuffix")}
            </p>
          ) : null}
        </Surface>

        <ListGroup header={t("enroll.studentInfo")}>
          <InfoRow
            leading={<UserAvatar src={profile.pictureUrl} name={profile.displayName} decorative />}
            label={t("enroll.name")}
            value={profile.displayName}
          />
        </ListGroup>

        {classDetails.totalHours ? (
          <p className="px-1 text-[13px] leading-[1.5] text-fg-muted">
            {t("enroll.hoursPrefix")} {classDetails.totalHours} {t("enroll.hoursSuffix")}
          </p>
        ) : null}
      </div>

      <BottomActionBar>
        <div className="min-w-0 shrink-0">
          <p className="text-xs leading-[1.5] text-fg-muted">{t("enroll.tuition")}</p>
          <p className="text-xl leading-[1.3] font-extrabold text-fg tabular-nums">
            {classDetails.price === 0 ? t("enroll.free") : formatTHB(classDetails.price)}
            {classDetails.price === 0 ? null : (
              <span className="ml-1 text-xs font-normal text-fg-muted">{t("enroll.perCourse")}</span>
            )}
          </p>
        </div>
        <Button
          variant="brand"
          size="cta"
          className={cn("min-w-0 flex-1", seats.isFull && "bg-fill-muted text-fg-muted shadow-none")}
          onClick={handleAction}
          disabled={seats.isFull}
          loading={enrolling}
        >
          {enrolling
            ? t("enroll.processing")
            : cta === "full"
              ? t("enroll.ctaFull")
              : cta === "free"
                ? t("enroll.ctaFree")
                : t("enroll.continue")}
          {enrolling || cta === "full" ? null : <ArrowRight aria-hidden="true" />}
        </Button>
      </BottomActionBar>
    </Screen>
  );
}

export default function EnrollPage() {
  return (
    <Suspense fallback={<EnrollSkeleton label={t("enroll.loadingPreparing")} />}>
      <EnrollContent />
    </Suspense>
  );
}
