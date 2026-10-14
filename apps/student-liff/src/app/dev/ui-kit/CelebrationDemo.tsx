"use client";

import { useState } from "react";
import { PartyPopper } from "lucide-react";
import { Confetti } from "@/components/celebrate/Confetti";
import type { ConfettiIntensity } from "@/components/celebrate/confettiModel";
import { Button } from "@/components/ui/button";

const LEVELS: { intensity: ConfettiIntensity; label: string }[] = [
  { intensity: "small", label: "เล็ก (รีวิว)" },
  { intensity: "medium", label: "กลาง (จบบท)" },
  { intensity: "big", label: "ใหญ่ (อันดับ 1–3 / ชำระเงิน)" },
];

/** Dev gallery: fire each confetti size on demand. */
export function CelebrationDemo() {
  const [shot, setShot] = useState<{ intensity: ConfettiIntensity; key: number }>({ intensity: "medium", key: 0 });
  return (
    <div className="flex flex-col gap-2">
      {LEVELS.map(({ intensity, label }) => (
        <Button
          key={intensity}
          variant={intensity === "big" ? "brand" : "brandSoft"}
          size="touch"
          data-celebrate-demo={intensity}
          onClick={() => setShot((prev) => ({ intensity, key: prev.key + 1 }))}
        >
          <PartyPopper aria-hidden="true" />
          {label}
        </Button>
      ))}
      <p className="text-xs text-fg-subtle">ปิดเอฟเฟกต์อัตโนมัติเมื่อเปิด “ลดการเคลื่อนไหว” ในเครื่อง</p>
      <Confetti fire={shot.key} intensity={shot.intensity} />
    </div>
  );
}
