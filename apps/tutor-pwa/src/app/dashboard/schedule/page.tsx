import { cookies } from "next/headers";
import ScheduleClient from "./schedule-client";
import { t } from "@/lib/i18n";
import { PageTransition } from "@/components/ui/page-transition";

async function getClassesData(token: string) {
  const res = await fetch("http://localhost:3002/v1/classes", {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.classes || [];
}

export default async function SchedulePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";
  
  const classesList = await getClassesData(token);

  return (
    <PageTransition variant="slide-up" stagger className="space-y-6 max-w-6xl mx-auto pb-24 sm:pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t("dashboardSchedule.title")}</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {t("dashboardSchedule.subtitle")}
          </p>
        </div>
      </div>

      <ScheduleClient initialClasses={classesList} />
    </PageTransition>
  );
}
