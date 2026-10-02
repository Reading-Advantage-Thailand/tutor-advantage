import { cookies } from "next/headers";
import { Page, PageHeader } from "@/components/app";
import { LEARNING_URL } from "@/lib/service-urls";
import { t } from "@/lib/i18n";
import type { ScheduleClass } from "./lib/schedule-events";
import ScheduleClient from "./schedule-client";

/** The tutor's classes (per-tutor data: never cached across requests). */
async function getClassesData(token: string | null): Promise<ScheduleClass[]> {
  if (!token) return [];
  try {
    const res = await fetch(`${LEARNING_URL}/v1/classes`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.classes || [];
  } catch (error) {
    console.error("[schedule] failed to load classes", error);
    return [];
  }
}

export default async function SchedulePage() {
  const cookieStore = await cookies();
  const classesList = await getClassesData(cookieStore.get("tutor_session")?.value || null);

  return (
    <Page>
      <PageHeader title={t("dashboardSchedule.title")} description={t("dashboardSchedule.subtitle")} />
      <ScheduleClient initialClasses={classesList} />
    </Page>
  );
}
