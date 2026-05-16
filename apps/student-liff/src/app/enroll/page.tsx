"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
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
      studentApi.getClassDetails(classId)
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
          setError(err instanceof Error ? err.message : t("enroll.errors.loadClassFailed"));
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

  // Handle payment redirect
  useEffect(() => {
    if (step === "payment" && classDetails) {
      router.push(`/payment?classId=${classDetails.classId}`);
    }
  }, [step, classDetails, router]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("enroll.loadingPreparing")}</p>
        </div>
      </div>
    );
  }

  if (!isReady || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground mb-2 font-medium">{t("enroll.redirectingLogin")}</p>
          <p className="text-xs text-slate-400">{t("enroll.loginReason")}</p>
        </div>
      </div>
    );
  }

  if (loading || !classDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          {error ? (
            <>
              <p className="text-red-600 font-semibold mb-4">{error}</p>
              <Link href="/dashboard" className="text-primary hover:underline">
                {t("enroll.backDashboard")}
              </Link>
            </>
          ) : (
            <>
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">{t("enroll.loadingClass")}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Step 1: Confirm enrollment
  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t("enroll.title")}</h1>
              <p className="text-xs text-muted-foreground">{t("enroll.confirmClass")}</p>
            </div>
          </div>

          {/* Class Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{classDetails.className}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">{t("enroll.tutor")}</span>
                  <span className="font-semibold text-foreground">{classDetails.tutorName}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">{t("enroll.book")}</span>
                  <span className="font-semibold text-foreground">{classDetails.bookTitle}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">{t("enroll.level")}</span>
                  <span className="font-semibold text-foreground">{classDetails.cefrLevel}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">{t("enroll.schedule")}</span>
                  <span className="font-semibold text-foreground text-right text-sm">
                    {classDetails.schedule}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">{t("enroll.students")}</span>
                  <span className="font-semibold text-foreground">
                    {classDetails.currentStudents}/{classDetails.maxStudents} {t("enroll.peopleUnit")}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200 my-4"></div>

              {/* Your info */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <p className="text-xs text-muted-foreground font-semibold">{t("enroll.studentInfo")}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t("enroll.name")}</span>
                  <span className="font-semibold text-foreground">{profile.displayName}</span>
                </div>
              </div>

              {/* Price */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-bold text-foreground">{t("enroll.tuition")}</span>
                  <span className="text-2xl font-black text-primary">
                    THB {classDetails.price.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("enroll.courseHoursNote")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Link href="/dashboard" className="flex-1">
              <Button variant="outline" className="w-full">
                {t("enroll.cancel")}
              </Button>
            </Link>
            <Button
              onClick={() => setStep("payment")}
              className="flex-1 gap-2"
            >
              {t("enroll.continue")}
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Payment (redirect to existing payment page)
  if (step === "payment") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("enroll.redirectingPayment")}</p>
        </div>
      </div>
    );
  }

  // Step 3: Success
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-6 flex items-center">
      <div className="max-w-sm mx-auto w-full text-center space-y-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("enroll.successTitle")}</h1>
          <p className="text-muted-foreground">
            {t("enroll.successPrefix")} {classDetails.className} {t("enroll.successSuffix")}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-3 text-left">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("enroll.tutor")}</p>
              <p className="font-semibold">{classDetails.tutorName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("enroll.firstLesson")}</p>
              <p className="font-semibold">{classDetails.schedule}</p>
            </div>
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            {t("enroll.lineNoticeFirst")}
            <br />
            {t("enroll.lineNoticeSecond")}
          </p>
        </div>

        <Link href="/dashboard" className="block">
          <Button className="w-full">
            {t("enroll.dashboardCta")}
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function EnrollPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">{t("enroll.loadingPreparing")}</p>
          </div>
        </div>
      }
    >
      <EnrollContent />
    </Suspense>
  );
}
