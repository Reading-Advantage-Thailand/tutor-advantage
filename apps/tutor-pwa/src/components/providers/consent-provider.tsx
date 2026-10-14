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
    <div className="fixed inset-0 z-(--z-consent) flex flex-col items-center overflow-y-auto bg-app px-4 pt-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))] sm:justify-center sm:p-6">
      <div className="relative my-4 w-full max-w-2xl rounded-2xl border border-hairline bg-surface p-5 shadow-card sm:my-10 sm:p-8">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-brand-soft text-brand-fg">
            <ShieldCheck className="size-7" />
          </div>
          <h2 className="text-xl font-bold text-fg sm:text-2xl">
            นโยบายความเป็นส่วนตัวและข้อตกลงการใช้งาน
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            PDPA & Terms of Service Agreement
          </p>
        </div>

        <div className="mb-6 h-64 space-y-4 overflow-y-auto rounded-xl border border-hairline bg-surface-muted p-4 text-sm leading-relaxed text-fg sm:p-5">
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
          <p className="pt-2 text-xs text-fg-muted">
            * เอกสารฉบับเต็มจะพร้อมให้ดาวน์โหลดได้ในเมนูการตั้งค่าหลังจากการเข้าสู่ระบบ
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-danger-border bg-danger-bg p-3 text-sm font-medium text-danger-fg">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-6 flex items-start gap-3 rounded-xl border border-brand-soft-border bg-brand-soft/60 p-4">
          <Checkbox
            id="terms"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked as boolean)}
            className="mt-1"
          />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor="terms"
              className="cursor-pointer text-sm font-semibold text-fg"
            >
              ข้าพเจ้าได้อ่านและยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว
            </label>
            <p className="text-xs text-fg-muted">
              ข้าพเจ้ายินยอมให้ประมวลผลข้อมูลส่วนบุคคลตามที่ระบุไว้
            </p>
          </div>
        </div>

        <Button
          onClick={handleAgree}
          disabled={!agreed || loading}
          size="xl" className="w-full"
        >
          {loading ? "กำลังดำเนินการ..." : "ยืนยันการยอมรับ"}
        </Button>
      </div>
    </div>
  );
}
