"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLiff } from "@/components/providers/LiffProvider";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  User,
  BookOpen,
  BarChart2,
  Calendar,
  Users,
  CreditCard,
  MessageCircle,
  Sparkles,
  Info,
} from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mx-auto mb-4" />
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
      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-indigo-500">{icon}</span>
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
  const referralToken = searchParams.get("token");

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"confirm" | "payment" | "success">("confirm");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;

    if (classId) {
      studentApi
        .getClassDetails(classId)
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

    if (referralToken) {
      setError(t("enroll.errors.referralMissingClassId"));
    } else {
      setError(t("enroll.errors.missingClass"));
    }
    setLoading(false);
  }, [isReady, classId, referralToken]);

  useEffect(() => {
    if (isReady && !profile) {
      const currentParams = searchParams.toString();
      const redirectTarget = encodeURIComponent(`/enroll?${currentParams}`);
      router.replace(`/login?redirect=${redirectTarget}`);
    }
  }, [isReady, profile, router, searchParams]);

  /* Redirect to payment page */
  useEffect(() => {
    if (step === "payment" && classDetails) {
      router.push(`/payment?classId=${classDetails.classId}`);
    }
  }, [step, classDetails, router]);

  /* ── Loading / auth states ── */
  if (!isReady) return <Spinner label={t("enroll.loadingPreparing")} />;
  if (!profile) return <Spinner label={t("enroll.redirectingLogin")} />;

  if (loading) return <Spinner label={t("enroll.loadingClass")} />;

  if (error || !classDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">😕</span>
          </div>
          <p className="text-rose-500 font-semibold">{error ?? t("enroll.errors.loadClassFailed")}</p>
          <Link href="/dashboard" className="text-indigo-500 text-sm font-medium hover:underline">
            {t("enroll.backDashboard")}
          </Link>
        </div>
      </div>
    );
  }

  /* ── Payment redirect waiting ── */
  if (step === "payment") {
    return <Spinner label={t("enroll.redirectingPayment")} />;
  }

  /* ── Success ── */
  if (step === "success") {
    return (
      <div className="min-h-screen bg-background px-4 py-8 flex items-center">
        <div className="max-w-sm mx-auto w-full space-y-5">
          {/* Success hero */}
          <div className="rounded-3xl overflow-hidden shadow-xl">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 pt-8 pb-6 text-center">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-2xl font-black text-white mb-1">{t("enroll.successTitle")}</h1>
              <p className="text-emerald-100 text-sm">
                {t("enroll.successPrefix")} {classDetails.className} {t("enroll.successSuffix")}
              </p>
            </div>

            {/* Details */}
            <div className="bg-card px-5 py-4 space-y-1">
              <DetailRow
                icon={<User size={14} />}
                label={t("enroll.tutor")}
                value={classDetails.tutorName}
              />
              <DetailRow
                icon={<Calendar size={14} />}
                label={t("enroll.firstLesson")}
                value={classDetails.schedule}
              />
            </div>
          </div>

          {/* LINE notice */}
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-4 flex gap-3">
            <MessageCircle className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
              {t("enroll.lineNoticeFirst")}
              <br />
              {t("enroll.lineNoticeSecond")}
            </p>
          </div>

          <Link href="/dashboard" className="block">
            <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-black text-base shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-all">
              {t("enroll.dashboardCta")}
            </button>
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
    <div className="min-h-screen bg-background">
      {/* ── Hero header ── */}
      <div className="relative bg-gradient-to-br from-indigo-500 to-violet-600 px-5 pt-12 pb-8">
        {/* Back button */}
        <Link href="/dashboard" className="absolute top-5 left-4">
          <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <ArrowLeft size={18} className="text-white" />
          </div>
        </Link>

        {/* Title chip */}
        <div className="flex justify-center mb-4">
          <span className="bg-white/20 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
            <Sparkles size={11} />
            {t("enroll.title")}
          </span>
        </div>

        {/* Class name */}
        <h1 className="text-2xl font-black text-white text-center leading-tight mb-3">
          {classDetails.className}
        </h1>

        {/* Pill badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
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
      <div className="px-4 -mt-4 pb-8 space-y-4 max-w-md mx-auto">

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
        <div className="bg-card rounded-3xl border border-border shadow-xl overflow-hidden">
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
                    : "bg-emerald-500"
                }`}
                style={{ width: `${spotsPercent}%` }}
              />
            </div>
            {spotsLeft <= 3 && (
              <p className="text-xs text-rose-500 font-semibold mt-1.5">
                ⚠️ เหลือเพียง {spotsLeft} ที่นั่ง!
              </p>
            )}
          </div>
        </div>

        {/* Student info card */}
        <div className="bg-card rounded-3xl border border-border shadow-lg overflow-hidden">
          <div className="bg-indigo-500/5 border-b border-border px-5 py-3 flex items-center gap-2">
            <User size={14} className="text-indigo-500" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              {t("enroll.studentInfo")}
            </span>
          </div>
          <div className="px-5 py-4 flex items-center gap-4">
            {profile.pictureUrl ? (
              <img
                src={profile.pictureUrl}
                alt={profile.displayName}
                className="w-14 h-14 rounded-full border-2 border-indigo-500/30 shadow-md object-cover shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                <User size={24} className="text-indigo-500" />
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">{t("enroll.name")}</p>
              <p className="font-black text-foreground text-base">{profile.displayName}</p>
            </div>
          </div>
        </div>

        {/* Price card */}
        <div className="bg-card rounded-3xl border border-indigo-500/30 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border-b border-indigo-500/20 px-5 py-3 flex items-center gap-2">
            <CreditCard size={14} className="text-indigo-500" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              {t("enroll.tuition")}
            </span>
          </div>
          <div className="px-5 py-5 text-center">
            <p className="text-5xl font-black text-indigo-600 dark:text-indigo-400 mb-1">
              {classDetails.price.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground font-semibold">THB / {t("enroll.courseHoursNote")}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <Link href="/dashboard" className="flex-1">
            <button className="w-full py-4 rounded-2xl border-2 border-border bg-card text-foreground font-bold text-sm active:scale-[0.98] transition-all">
              {t("enroll.cancel")}
            </button>
          </Link>
          <button
            className="flex-2 flex-[2] py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-black text-base shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            onClick={() => setStep("payment")}
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
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">{t("enroll.loadingPreparing")}</p>
          </div>
        </div>
      }
    >
      <EnrollContent />
    </Suspense>
  );
}
