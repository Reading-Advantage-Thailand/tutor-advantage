"use client";

import { useState, type ReactNode } from "react";
import { SegmentedControl } from "@/components/app";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type HistoryView = "meetings" | "students";

/** Phones and tablets show one list at a time; from lg both sit side by side. */
export function HistoryPanels({ meetings, students }: { meetings: ReactNode; students: ReactNode }) {
  const [view, setView] = useState<HistoryView>("meetings");
  return (
    <>
      <SegmentedControl<HistoryView>
        aria-label={t("tutorClass.attendance.viewLabel")}
        className="lg:hidden"
        fullWidth
        value={view}
        onValueChange={setView}
        items={[
          { value: "meetings", label: t("tutorClass.attendance.viewMeetings") },
          { value: "students", label: t("tutorClass.attendance.viewStudents") },
        ]}
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div className={cn("min-w-0", view !== "meetings" && "max-lg:hidden")}>{meetings}</div>
        <div className={cn("min-w-0", view !== "students" && "max-lg:hidden")}>{students}</div>
      </div>
    </>
  );
}
