"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { RescheduleSheetProps } from "./RescheduleSheet";

const loadSheet = () => import("./RescheduleSheet");
const RescheduleSheet = dynamic(loadSheet, { ssr: false });

/**
 * "แก้ไขตารางเรียน" button. The sheet (calendar, date maths) is a separate
 * chunk: preloaded on hover/focus and mounted on first open.
 */
export function RescheduleClassButton(props: Omit<RescheduleSheetProps, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const preload = () => {
    void loadSheet();
  };
  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        onPointerEnter={preload}
        onFocus={preload}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <CalendarClock aria-hidden="true" />
        {t("tutorClass.detail.rescheduleButton")}
      </Button>
      {mounted ? <RescheduleSheet {...props} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
