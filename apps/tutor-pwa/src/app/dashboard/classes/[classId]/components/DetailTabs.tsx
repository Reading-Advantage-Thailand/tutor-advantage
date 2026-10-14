"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { SegmentedControl } from "@/components/app";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type DetailTab = "lessons" | "overview" | "students";

const TabContext = createContext<DetailTab>("lessons");

/**
 * Phone/tablet (< lg): a segmented control shows one group of blocks at a
 * time. Desktop (lg+): every block is visible in the two-column layout, so
 * the panels are only hidden below lg (CSS), never unmounted.
 */
export function DetailTabs({ children, initial = "lessons" }: { children: ReactNode; initial?: DetailTab }) {
  const [tab, setTab] = useState<DetailTab>(initial);
  return (
    <TabContext.Provider value={tab}>
      <div className="sticky top-[calc(var(--appbar-h)+var(--safe-top))] z-(--z-sticky) -mx-(--gutter) -my-3 bg-app px-(--gutter) py-2 md:top-0 lg:hidden">
        <SegmentedControl<DetailTab>
          aria-label={t("tutorClass.view.sectionsLabel")}
          fullWidth
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "lessons", label: t("tutorClass.view.tabLessons") },
            { value: "overview", label: t("tutorClass.view.tabOverview") },
            { value: "students", label: t("tutorClass.view.tabStudents") },
          ]}
        />
      </div>
      {children}
    </TabContext.Provider>
  );
}

/** A block that belongs to one tab (hidden below lg when another tab is active). */
export function TabPanel({ tab, children, className }: { tab: DetailTab; children: ReactNode; className?: string }) {
  const active = useContext(TabContext);
  return <div className={cn("flex min-w-0 flex-col gap-6", active !== tab && "max-lg:hidden", className)}>{children}</div>;
}
