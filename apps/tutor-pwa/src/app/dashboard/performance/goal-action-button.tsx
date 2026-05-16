"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowUpRight, CheckCircle2, BookOpen, MessageSquare, Users, Star } from "lucide-react";
import Link from "next/link";
import { t } from "@/lib/i18n";

type GoalDetails = {
  code: string;
  label: string;
};

const GOAL_ACTIONS: Record<string, { tips: string[]; link?: { href: string; label: string }; icon: any }> = {
  "RISING_STAR": {
    icon: Star,
    tips: [
      t("dashboardPerformance.tips.risingStar1"),
      t("dashboardPerformance.tips.risingStar2"),
      t("dashboardPerformance.tips.risingStar3"),
    ],
    link: { href: "/dashboard/schedule", label: t("dashboardPerformance.goalLinks.schedule") }
  },
  "FAST_RESPONDER": {
    icon: MessageSquare,
    tips: [
      t("dashboardPerformance.tips.fastResponder1"),
      t("dashboardPerformance.tips.fastResponder2"),
      t("dashboardPerformance.tips.fastResponder3"),
    ],
    link: { href: "/dashboard/chat", label: t("dashboardPerformance.goalLinks.chat") }
  },
  "TOP_RATED": {
    icon: AwardIcon,
    tips: [
      t("dashboardPerformance.tips.topRated1"),
      t("dashboardPerformance.tips.topRated2"),
      t("dashboardPerformance.tips.topRated3"),
    ],
    link: { href: "/dashboard/classes", label: t("dashboardPerformance.goalLinks.classes") }
  },
  "NETWORK_BUILDER": {
    icon: Users,
    tips: [
      t("dashboardPerformance.tips.networkBuilder1"),
      t("dashboardPerformance.tips.networkBuilder2"),
      t("dashboardPerformance.tips.networkBuilder3"),
    ],
    link: { href: "/dashboard/network", label: t("dashboardPerformance.goalLinks.network") }
  },
  "CLASS_MASTER": {
    icon: BookOpen,
    tips: [
      t("dashboardPerformance.tips.classMaster1"),
      t("dashboardPerformance.tips.classMaster2"),
      t("dashboardPerformance.tips.classMaster3"),
    ],
    link: { href: "/dashboard/classes", label: t("dashboardPerformance.goalLinks.classes") }
  },
  "ELITE_EDUCATOR": {
    icon: Star,
    tips: [
      t("dashboardPerformance.tips.eliteEducator1"),
      t("dashboardPerformance.tips.eliteEducator2"),
      t("dashboardPerformance.tips.eliteEducator3"),
    ]
  },
  "AI_PIONEER": {
    icon: Star,
    tips: [
      t("dashboardPerformance.tips.aiPioneer1"),
      t("dashboardPerformance.tips.aiPioneer2"),
      t("dashboardPerformance.tips.aiPioneer3"),
    ]
  }
};

// Temporary inner wrapper to bypass recursion for dynamic icon import
function AwardIcon(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></svg>
}

export function GoalActionButton({ goal }: { goal: GoalDetails }) {
  const [open, setOpen] = useState(false);
  
  const config = GOAL_ACTIONS[goal.code] || {
    icon: Star,
    tips: [
      t("dashboardPerformance.defaultTips.first"),
      t("dashboardPerformance.defaultTips.second"),
    ],
  };

  const Icon = config.icon;

  return (
    <>
      <Button 
        onClick={() => setOpen(true)}
        variant="outline" 
        className="w-full sm:w-auto border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 shrink-0 shadow-sm group"
      >
        {t("dashboardPerformance.goalAction")} <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 rounded-full bg-amber-500/10">
                <Icon className="h-5 w-5 text-amber-600" />
              </div>
              {t("dashboardPerformance.developmentPlanPrefix")} {goal.label}
            </DialogTitle>
            <DialogDescription>
              {t("dashboardPerformance.bestPracticesDescription")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-2">
            {config.tips.map((tip, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border border-border/40">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-foreground leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between items-center">
            {config.link ? (
              <Link href={config.link.href} className="w-full sm:w-auto" onClick={() => setOpen(false)}>
                <Button className="w-full">
                  {config.link.label} <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            ) : <div />}
            <Button variant="ghost" onClick={() => setOpen(false)} className="w-full sm:w-auto text-muted-foreground">
              {t("dashboardPerformance.understood")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
