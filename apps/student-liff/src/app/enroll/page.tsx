"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLiff } from "@/components/providers/LiffProvider";
import {
  ArrowLeft,
  ArrowRight,
  User,
  BookOpen,
  BarChart2,
  Calendar,
  Users,
  CreditCard,
  Info,
  CheckCircle2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { studentApi } from "@/lib/api";
import { t } from "@/lib/i18n";

interface ClassDetails {
  classId: string;
  className: string;
  tutorName: string;
  bookTitle: string;
  price: number;
  maxStudents: number;
  currentStudents: number;
  cefrLevel: string;
  schedule: string;
}

/* ─── Spinner used in multiple states ─── */
function Spinner({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--surface-bg)" }}>
      <div className="text-center">
        <div className="w-14 h-14 rounded-full border-4 animate-spin mx-auto mb-4" style={{ borderColor: "var(--brand-100)", borderTopColor: "var(--brand-500)" }} />
        <p className="text-muted-foreground font-medium">{label}</p>
      </div>
    </div>
  );
}

/* ─── Detail row ─── */
function DetailRow({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: "var(--brand-50)" }}>
        <span style={{ color: "var(--brand-600)" }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className={`font-semibold text-sm text-foreground leading-tight ${valueClass ?? ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* ─── Main content ─── */
function EnrollContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, isReady } = useLiff();

  const classId = searchParams.get("classId");
  const referralToken = searchParams.get("referralToken") ?? searchParams.get("token");

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;

    if (classId || referralToken) {
      const classDetailsRequest = classId
        ? studentApi.getClassDetails(classId)
        : studentApi.getReferralDetails(referralToken as string);

      classDetailsRequest
        .then((data) => {
          const cls = data.class;
          setClassDetails({
            classId: cls.id,
            className: cls.name,
            tutorName: cls.tutor?.name || "Tutor Advantage",
            bookTitle: cls.book,
            price: cls.price,
            maxStudents: cls.maxStudents,
            currentStudents: cls.students,
            cefrLevel: cls.cefr,
            schedule: cls.schedule,
          });
        })
        .catch((err) => {
          console.error("Failed to fetch class details for enrollment:", err);
          setError(
            err instanceof Error ? err.message : t("enroll.errors.loadClassFailed")
          );
        })
        .finally(() => setLoading(false));
      return;
    }

    setError(t("enroll.errors.missingClass"));
    setLoading(false);
  }, [isReady, classId, referralToken]);

  useEffect(() => {
    if (isReady && !profile) {
      const currentParams = searchParams.toString();
      const redirectTarget = encodeURIComponent(`/enroll?${currentParams}`);
      router.replace(`/login?redirect=${redirectTarget}`);
    }
  }, [isReady, profile, router, searchParams]);

  const goToPayment = () => {
    if (!classDetails) return;
    const params = new URLSearchParams({ classId: classDetails.classId });
    if (referralToken) params.set("referralToken", referralToken);
    router.push(`/payment?${params.toString()}`);
  };

  /* ── Loading / auth states ── */
  if (!isReady) return <Spinner label={t("enroll.loadingPreparing")} />;
  if (!profile) return <Spinner label={t("enroll.redirectingLogin")} />;

  if (loading) return <Spinner label={t("enroll.loadingClass")} />;

  if (error || !classDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--surface-bg)" }}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto">
            <Info className="text-rose-500" size={28} />
          </div>
          <p className="text-rose-500 font-semibold">{error ?? t("enroll.errors.loadClassFailed")}</p>
          <Link href="/dashboard" className="text-sm font-medium hover:underline" style={{ color: "var(--brand-600)" }}>
            {t("enroll.backDashboard")}
          </Link>
        </div>
      </div>
    );
  }

  /* ── Confirm step ── */
  const spotsLeft = classDetails.maxStudents - classDetails.currentStudents;
  const isFull = spotsLeft <= 0;
  const spotsPercent = Math.round((classDetails.currentStudents / classDetails.maxStudents) * 100);

  return (
    <div style={{ background: "var(--surface-bg)", minHeight: "100dvh" }}>
      {/* ── Hero header ── */}
      <div
        className="curved-bottom relative px-5 pb-9 pt-12"
        style={{ background: "linear-gradient(135deg, #06c755 0%, #049a42 55%, #037d36 100%)" }}
      >
        {/* Back button */}
        <Link href="/dashboard" className="absolute top-5 left-4">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </div>
        </Link>

        {/* Title chip */}
        <div className="mb-4 mt-4">
          <span className="bg-white/20 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
            <CheckCircle2 size={11} />
            {t("enroll.title")}
          </span>
        </div>

        {/* Class name */}
        <h1 className="text-2xl font-black text-white leading-tight mb-3">
          {classDetails.className}
        </h1>

        {/* Pill badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {classDetails.cefrLevel && (
            <span className="bg-white/25 text-white text-xs font-bold px-3 py-1 rounded-full">
              CEFR {classDetails.cefrLevel}
            </span>
          )}
          <span className="bg-white/25 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <Users size={10} /> {classDetails.currentStudents}/{classDetails.maxStudents}
          </span>
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="px-4 -mt-5 pb-[calc(112px+var(--safe-bottom))] space-y-3 max-w-md mx-auto">

        {/* Fallback banner — shown when class is full */}
        {isFull && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 px-4 py-4 flex gap-3">
            <Info className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-0.5">
                {t("enroll.fallbackBannerTitle")}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                {t("enroll.fallbackBannerDesc")}
              </p>
            </div>
          </div>
        )}

        {/* Class details card */}
        <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
          <div className="px-5 pt-5 pb-2">
            <DetailRow
              icon={<User size={14} />}
              label={t("enroll.tutor")}
              value={classDetails.tutorName}
            />
            <DetailRow
              icon={<BookOpen size={14} />}
              label={t("enroll.book")}
              value={classDetails.bookTitle}
            />
            <DetailRow
              icon={<BarChart2 size={14} />}
              label={t("enroll.level")}
              value={classDetails.cefrLevel}
            />
            <DetailRow
              icon={<Calendar size={14} />}
              label={t("enroll.schedule")}
              value={classDetails.schedule}
            />
          </div>

          {/* Seats progress */}
          <div className="px-5 py-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">{t("enroll.students")}</span>
              <span className="text-xs font-bold text-foreground">
                {classDetails.currentStudents}/{classDetails.maxStudents}{" "}
                <span className="text-muted-foreground font-normal">{t("enroll.peopleUnit")}</span>
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  spotsPercent >= 90
                    ? "bg-rose-500"
                    : spotsPercent >= 70
                    ? "bg-amber-400"
                    : "bg-[var(--brand-500)]"
                }`}
                style={{ width: `${spotsPercent}%` }}
              />
            </div>
            {spotsLeft <= 3 && (
              <p className="text-xs text-rose-500 font-semibold mt-1.5">
                {t("enroll.urgentSeatsPrefix")} {spotsLeft} {t("enroll.urgentSeatsSuffix")}
              </p>
            )}
          </div>
        </div>

        {/* Student info card */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="border-b border-border px-5 py-3 flex items-center gap-2" style={{ background: "var(--brand-50)" }}>
            <User size={14} style={{ color: "var(--brand-600)" }} />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              {t("enroll.studentInfo")}
            </span>
          </div>
          <div className="px-5 py-4 flex items-center gap-4">
            {profile.pictureUrl ? (
              <Image
                src={profile.pictureUrl}
                alt={profile.displayName}
                width={56}
                height={56}
                unoptimized
                className="w-14 h-14 rounded-full border-2 shadow-sm object-cover shrink-0"
                style={{ borderColor: "var(--brand-200)" }}
              />
            ) : (
              <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--brand-50)" }}>
                <User size={24} style={{ color: "var(--brand-600)" }} />
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("enroll.name")}</p>
              <p className="font-black text-foreground text-base">{profile.displayName}</p>
            </div>
          </div>
        </div>

        {/* Price card */}
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: "var(--brand-200)" }}>
          <div className="border-b px-5 py-3 flex items-center gap-2" style={{ background: "var(--brand-50)", borderColor: "var(--brand-100)" }}>
            <CreditCard size={14} style={{ color: "var(--brand-600)" }} />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              {t("enroll.tuition")}
            </span>
          </div>
          <div className="px-5 py-5 text-center">
            <p className="text-5xl font-black mb-1" style={{ color: "var(--brand-600)" }}>
              {classDetails.price.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground font-semibold">THB / {t("enroll.courseHoursNote")}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <Link href="/dashboard" className="flex-1">
            <button className="w-full py-4 rounded-2xl border border-border bg-card text-foreground font-bold text-sm active:scale-[0.98] transition-all">
              {t("enroll.cancel")}
            </button>
          </Link>
          <button
            className="flex-2 flex-[2] py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            style={{ background: isFull ? "var(--neutral-400)" : "var(--brand-500)", boxShadow: isFull ? "none" : "var(--shadow-green)" }}
            onClick={goToPayment}
            disabled={isFull}
          >
            {t("enroll.continue")}
            <ArrowRight size={18} />
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-2">
          {t("enroll.courseHoursNote")}
        </p>
      </div>
    </div>
  );
}

export default function EnrollPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-bg)" }}>
          <div className="text-center">
            <div className="w-14 h-14 rounded-full border-4 animate-spin mx-auto mb-4" style={{ borderColor: "var(--brand-100)", borderTopColor: "var(--brand-500)" }} />
            <p className="text-muted-foreground font-medium">{t("enroll.loadingPreparing")}</p>
          </div>
        </div>
      }
    >
      <EnrollContent />
    </Suspense>
  );
}
