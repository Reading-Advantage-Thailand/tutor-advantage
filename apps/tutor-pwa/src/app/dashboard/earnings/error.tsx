"use client";

import { Button } from "@/components/ui/button";

export default function EarningsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <span className="text-3xl">💰</span>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">โหลดรายได้ไม่สำเร็จ</h2>
        <p className="text-sm font-medium text-muted-foreground max-w-sm">
          ไม่สามารถโหลดข้อมูลรายได้ได้ กรุณาลองใหม่อีกครั้ง
        </p>
      </div>
      <Button onClick={reset} className="gap-2">
        ลองใหม่
      </Button>
    </div>
  );
}
