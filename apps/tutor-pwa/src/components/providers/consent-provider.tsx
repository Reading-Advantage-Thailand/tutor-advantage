"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertCircle } from "lucide-react";

interface ConsentProviderProps {
  children: React.ReactNode;
  hasConsent: boolean;
}

export function ConsentProvider({ children, hasConsent }: ConsentProviderProps) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  if (hasConsent) {
    return <>{children}</>;
  }

  const handleAgree = async () => {
    if (!agreed) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consentType: "TERMS_AND_PRIVACY" }),
      });

      if (!res.ok) {
        throw new Error("Failed to record consent");
      }

      // Refresh the page so the server-side session check detects the consent
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-2xl p-6 sm:p-8 relative mt-10 mb-10">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-brand-500/10 text-brand-600 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-foreground">
            นโยบายความเป็นส่วนตัวและข้อตกลงการใช้งาน
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            PDPA & Terms of Service Agreement
          </p>
        </div>

        <div className="bg-muted/30 rounded-xl p-4 sm:p-6 h-64 overflow-y-auto border border-border/50 text-sm text-foreground space-y-4 mb-6">
          <p>
            <strong>นโยบายความเป็นส่วนตัว (Privacy Policy)</strong>
          </p>
          <p>
            แพลตฟอร์มของเราให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของคุณ (PDPA)
            เราจะทำการเก็บรวบรวม ใช้ และเปิดเผยข้อมูลของคุณเฉพาะเท่าที่จำเป็นเพื่อให้บริการ
            รวมถึงการจ่ายผลตอบแทน การตรวจสอบประวัติ และการติดต่อสื่อสาร
          </p>
          <p>
            <strong>ข้อตกลงการใช้งาน (Terms of Service)</strong>
          </p>
          <p>
            1. คุณยืนยันว่าข้อมูลที่ให้ไว้เป็นความจริงทุกประการ <br />
            2. คุณยินยอมให้แพลตฟอร์มประมวลผลข้อมูลการสอนและการเงินของคุณ <br />
            3. การกระทำที่ผิดต่อกฎหมายหรือข้อตกลง อาจทำให้บัญชีของคุณถูกระงับ
          </p>
          <p className="text-xs text-muted-foreground pt-4">
            * เอกสารฉบับเต็มจะพร้อมให้ดาวน์โหลดได้ในเมนูการตั้งค่าหลังจากการเข้าสู่ระบบ
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 text-red-600 text-sm font-semibold">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-start space-x-3 mb-6 bg-brand-500/5 p-4 rounded-xl border border-brand-500/20">
          <Checkbox
            id="terms"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked as boolean)}
            className="mt-1"
          />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="terms"
              className="text-sm font-semibold text-foreground cursor-pointer"
            >
              ข้าพเจ้าได้อ่านและยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว
            </label>
            <p className="text-xs text-muted-foreground">
              ข้าพเจ้ายินยอมให้ประมวลผลข้อมูลส่วนบุคคลตามที่ระบุไว้
            </p>
          </div>
        </div>

        <Button
          onClick={handleAgree}
          disabled={!agreed || loading}
          className="w-full h-12 rounded-xl text-base font-bold"
        >
          {loading ? "กำลังดำเนินการ..." : "ยืนยันการยอมรับ"}
        </Button>
      </div>
    </div>
  );
}
