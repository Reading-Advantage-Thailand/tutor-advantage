"use client";

import { AlertCircle, FileDown } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/lib/i18n";
import { getMissingTawi50Fields, type Tawi50RequiredSettings } from "@/lib/tawi50Requirements";

type Tawi50DownloadButtonProps = {
  href: string;
  filename: string;
  settings: Tawi50RequiredSettings | null;
};

export function Tawi50DownloadButton({ href, filename, settings }: Tawi50DownloadButtonProps) {
  const router = useRouter();
  const [showMissingFields, setShowMissingFields] = useState(false);
  const missingFields = getMissingTawi50Fields(settings);

  const handleClick = () => {
    if (missingFields.length === 0) {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return;
    }

    setShowMissingFields(true);
  };

  const goToFinanceSettings = () => {
    setShowMissingFields(false);
    router.push("/dashboard/settings#verify");
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 text-[10px] font-bold transition-colors border border-brand-500/20 hover:border-brand-500/40 press-scale"
      >
        <FileDown className="h-3 w-3" />
        {t("dashboardEarnings.downloadTawi50")}
      </button>

      <Dialog open={showMissingFields} onOpenChange={setShowMissingFields}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              ยังดาวน์โหลดใบ 50 ทวิไม่ได้
            </DialogTitle>
            <DialogDescription>
              กรุณากรอกข้อมูลบัญชีและการเงินให้ครบก่อน ระบบจะพาไปหน้าตั้งค่าและไฮไลต์ปุ่มที่ต้องกด
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs font-bold text-foreground mb-2">ข้อมูลที่ยังขาด</p>
            <ul className="space-y-1">
              {missingFields.map((field) => (
                <li key={field.key} className="flex items-start gap-2 text-xs font-semibold text-muted-foreground">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span>{field.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMissingFields(false)}>
              ปิด
            </Button>
            <Button onClick={goToFinanceSettings} className="bg-brand-500 hover:bg-brand-600 text-white">
              ไปกรอกข้อมูล
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
