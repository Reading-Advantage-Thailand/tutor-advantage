import type { Tone } from "@/components/app";
import { t } from "@/lib/i18n";

/** Class enrolment status → Thai label + chip tone (shared by list and detail). */
export type ClassStatus = "open" | "full" | "closed";

export const CLASS_STATUS: Record<ClassStatus, { label: string; tone: Tone }> = {
  open: { label: t("tutorClass.classes.statusOpen"), tone: "success" },
  full: { label: t("tutorClass.classes.statusFull"), tone: "warning" },
  closed: { label: t("tutorClass.classes.statusClosed"), tone: "neutral" },
};

export function classStatusInfo(status: string | null | undefined) {
  return CLASS_STATUS[(status as ClassStatus) || "closed"] ?? CLASS_STATUS.closed;
}
