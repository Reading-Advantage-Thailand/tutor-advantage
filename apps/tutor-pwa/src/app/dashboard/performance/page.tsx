import { cookies } from "next/headers";
import { Notice, Page } from "@/components/app";
import { t } from "@/lib/i18n";
import type { PerformanceData } from "./performance-data";
import { PerformanceHeader, PerformanceView, type EarningsSummary } from "./performance-view";

async function getPerformanceData(token: string): Promise<PerformanceData | null> {
  try {
    const baseUrl = process.env.LEARNING_API_BASE_URL || "http://localhost:3002";
    const res = await fetch(`${baseUrl}/v1/tutors/performance`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch performance data:", error);
    return null;
  }
}

async function getEarningsSummary(token: string): Promise<EarningsSummary | null> {
  try {
    const baseUrl = process.env.FINANCE_API_BASE_URL || "http://localhost:3003";
    const res = await fetch(`${baseUrl}/v1/tutors/earnings/summary`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch earnings summary:", error);
    return null;
  }
}

export default async function PerformancePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) {
    return (
      <Page>
        <PerformanceHeader />
        <Notice tone="warning">{t("dashboardPerformance.loginRequired")}</Notice>
      </Page>
    );
  }

  const [performanceData, earningsData] = await Promise.all([getPerformanceData(token), getEarningsSummary(token)]);

  return <PerformanceView performanceData={performanceData} earningsData={earningsData} />;
}
