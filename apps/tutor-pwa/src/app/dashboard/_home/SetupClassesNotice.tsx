import Link from "next/link";
import { ChevronRight, Settings2 } from "lucide-react";
import { Notice } from "@/components/app";
import { t } from "@/lib/i18n";
import { classSetupHref } from "@/lib/tutorClassFlow";
import { setupNoticeLine, type ClassNeedingSetup } from "./home-data";

/**
 * Top-of-Home warning for classes an admin created for this tutor. One class:
 * the whole notice links to its setup page; several: one link per class.
 * Server component.
 */
export function SetupClassesNotice({ classes }: { classes: ClassNeedingSetup[] }) {
  if (classes.length === 0) return null;

  if (classes.length === 1) {
    return (
      <Notice tone="warning" icon={Settings2} href={classSetupHref(classes[0].classId)} title={t("dashboardHome.setupNoticeTitle")}>
        {setupNoticeLine(classes[0])}
      </Notice>
    );
  }

  return (
    <Notice tone="warning" icon={Settings2} title={t("dashboardHome.setupNoticeTitle")}>
      <ul className="mt-1 flex flex-col gap-1">
        {classes.map((cls) => (
          <li key={cls.classId}>
            <Link
              href={classSetupHref(cls.classId)}
              className="inline-flex items-start gap-1 rounded-md underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <span className="min-w-0">{setupNoticeLine(cls)}</span>
              <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 opacity-70" />
            </Link>
          </li>
        ))}
      </ul>
    </Notice>
  );
}
