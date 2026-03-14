"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Copy, CheckCircle2, BookOpen } from "lucide-react";

export function ReferralLink({ referralLink }: { referralLink: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" />
          ลิงก์เชิญนักเรียน (Referral Link)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={referralLink}
            className="flex-1 h-9 rounded-lg border border-input bg-muted px-3 text-xs text-foreground font-mono"
          />
          <button
            onClick={handleCopy}
            id="btn-copy-referral"
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-input hover:bg-muted transition-colors"
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          แชร์ลิงก์นี้ให้ผู้ปกครองสมัครและชำระเงินผ่าน LINE ได้ทันที
        </p>
      </CardContent>
    </Card>
  );
}

export function LessonPlan({ lessonPlan }: { lessonPlan: string[] }) {
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);

  const toggleStep = (i: number) =>
    setCheckedSteps((prev) =>
      prev.includes(i) ? prev.filter((s) => s !== i) : [...prev, i]
    );

  const progress = Math.round((checkedSteps.length / lessonPlan.length) * 100);

  return (
    <Card className="border-border/60 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            แผนการสอน 15 ขั้นตอน
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {checkedSteps.length}/{lessonPlan.length} เสร็จแล้ว
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-1.5 mt-3">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-1">
          {lessonPlan.map((step, i) => {
            const done = checkedSteps.includes(i);
            return (
              <li
                key={i}
                id={`lesson-step-${i + 1}`}
                onClick={() => toggleStep(i)}
                className={`flex items-start gap-3 rounded-lg p-2.5 cursor-pointer transition-all ${
                  done ? "opacity-60" : "hover:bg-muted/60"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-all ${
                    done
                      ? "bg-primary text-primary-foreground"
                      : "border-2 border-border text-muted-foreground"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span
                  className={`text-sm ${
                    done ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {step}
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
