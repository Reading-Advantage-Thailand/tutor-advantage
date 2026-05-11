"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

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

    // TODO: Fetch class details from API using classId or referralToken
    // For now, use mock data
    if (classId || referralToken) {
      const mockClass: ClassDetails = {
        classId: classId || "cls-001",
        className: "Origins 1 - Advanced Group",
        tutorName: "อ.สีวา สุขพร้อม",
        bookTitle: "Origins 1",
        price: 2800,
        maxStudents: 15,
        currentStudents: 8,
        cefrLevel: "A1",
        schedule: "every Saturday 19:00-21:00",
      };
      setClassDetails(mockClass);
    } else {
      setError("ไม่พบข้อมูลคลาส กรุณาตรวจสอบลิงก์");
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
          <p className="text-muted-foreground">กำลังเตรียมข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!isReady || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground mb-2 font-medium">กำลังพาคุณไปหน้าเข้าสู่ระบบ...</p>
          <p className="text-xs text-slate-400">เพื่อดำเนินการสมัครเข้าคลาสเรียน</p>
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
                กลับไปหน้า Dashboard
              </Link>
            </>
          ) : (
            <>
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">กำลังโหลดข้อมูลคลาส...</p>
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
              <h1 className="text-xl font-bold text-foreground">สมัครเรียน</h1>
              <p className="text-xs text-muted-foreground">ยืนยันข้อมูลคลาส</p>
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
                  <span className="text-sm text-muted-foreground">ติวเตอร์</span>
                  <span className="font-semibold text-foreground">{classDetails.tutorName}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">หนังสือเรียน</span>
                  <span className="font-semibold text-foreground">{classDetails.bookTitle}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">ระดับ</span>
                  <span className="font-semibold text-foreground">{classDetails.cefrLevel}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">วันและเวลา</span>
                  <span className="font-semibold text-foreground text-right text-sm">
                    {classDetails.schedule}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">นักเรียน</span>
                  <span className="font-semibold text-foreground">
                    {classDetails.currentStudents}/{classDetails.maxStudents} คน
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200 my-4"></div>

              {/* Your info */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <p className="text-xs text-muted-foreground font-semibold">ข้อมูลนักเรียน</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">ชื่อ</span>
                  <span className="font-semibold text-foreground">{profile.displayName}</span>
                </div>
              </div>

              {/* Price */}
              <div className="border-t border-slate-200 pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-bold text-foreground">ค่าเรียน</span>
                  <span className="text-2xl font-black text-primary">
                    ฿{classDetails.price.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  เรียนประมาณ 25 ชั่วโมง ตลอดหลักสูตร
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Link href="/dashboard" className="flex-1">
              <Button variant="outline" className="w-full">
                ยกเลิก
              </Button>
            </Link>
            <Button
              onClick={() => setStep("payment")}
              className="flex-1 gap-2"
            >
              ดำเนินการต่อ
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
          <p className="text-muted-foreground">กำลังเปลี่ยนไปหน้าชำระเงิน...</p>
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
          <h1 className="text-2xl font-bold text-foreground mb-2">สมัครเสร็จแล้ว!</h1>
          <p className="text-muted-foreground">
            คุณได้สมัครเรียน {classDetails.className} เรียบร้อยแล้ว
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-3 text-left">
            <div>
              <p className="text-xs text-muted-foreground mb-1">ติวเตอร์</p>
              <p className="font-semibold">{classDetails.tutorName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">เรียนครั้งแรก</p>
              <p className="font-semibold">{classDetails.schedule}</p>
            </div>
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            📱 ติวเตอร์จะติดต่อคุณผ่าน LINE
            <br />
            ตรวจสอบการแจ้งเตือนจาก LINE Official Account
          </p>
        </div>

        <Link href="/dashboard" className="block">
          <Button className="w-full">
            ไปหน้า Dashboard
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
            <p className="text-muted-foreground">กำลังเตรียมข้อมูล...</p>
          </div>
        </div>
      }
    >
      <EnrollContent />
    </Suspense>
  );
}
