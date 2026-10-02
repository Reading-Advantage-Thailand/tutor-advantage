import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { BookOpen, Calendar, Plus, Users, Wallet } from "lucide-react";
import {
  Chip,
  EmptyState,
  Grid,
  IconTile,
  ListGroup,
  ListRow,
  Notice,
  Page,
  PageHeader,
  Section,
  SplitLayout,
  StatCard,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import VerificationBanner from "@/components/dashboard/verification-banner";
import { RoleUpgradeBanner } from "@/components/dashboard/role-upgrade-banner";
import { formatNumber, formatTHB } from "@/lib/format";
import { t } from "@/lib/i18n";
import { RateGoalCard } from "./_home/RateGoalCard";
import { formatRatePercent } from "./_shared/text";
import {
  classStatusTone,
  computeRateGoal,
  type FinanceSummary,
  type LearningSummary,
  type RecentClass,
} from "./_home/home-data";

async function fetchJsonOrNull<T>(url: string, token: string): Promise<T | null> {
  try {
    // Per-tutor data: never share through the Next data cache.
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.error("[dashboard] fetch failed:", url, error);
    return null;
  }
}

function getLearningData(token: string) {
  const base = process.env.LEARNING_API_BASE_URL || "http://localhost:3002";
  return fetchJsonOrNull<LearningSummary>(`${base}/v1/dashboard/summary`, token);
}

function getFinanceData(token: string) {
  const base = process.env.FINANCE_API_BASE_URL || "http://localhost:3003";
  return fetchJsonOrNull<FinanceSummary>(`${base}/v1/tutors/earnings/summary`, token);
}

const statusLabel = {
  open: t("tutorClass.classes.statusOpen"),
  full: t("tutorClass.classes.statusFull"),
  closed: t("tutorClass.classes.statusClosed"),
} as const;

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const [learning, finance] = await Promise.all([getLearningData(token), getFinanceData(token)]);

  const weeklyCount = learning?.classesThisWeek ?? 0;
  const goal = computeRateGoal(finance);
  const estimatedIncome = finance?.estimatedCommissionTHB ?? 0;
  const recentClasses: RecentClass[] = learning?.recentClasses ?? [];

  const createClassButton = (
    <Button id="btn-create-class" render={<Link href="/dashboard/classes/new" />} nativeButton={false}>
      <Plus aria-hidden="true" />
      {t("tutorClass.classes.create")}
    </Button>
  );

  return (
    <Page>
      <Suspense>
        <RoleUpgradeBanner />
      </Suspense>
      <VerificationBanner />

      <PageHeader
        title={t("dashboardHome.title")}
        description={t("dashboardHome.subtitle")}
        actions={createClassButton}
      />

      {!learning || !finance ? <Notice tone="warning">{t("dashboardHome.dataUnavailable")}</Notice> : null}

      <Grid cols={4} className="grid-cols-2">
        <StatCard
          label={t("dashboardHome.openClasses")}
          value={formatNumber(learning?.openClasses ?? 0)}
          icon={BookOpen}
          tone="blue"
          href="/dashboard/classes"
        />
        <StatCard
          label={t("dashboardHome.totalStudents")}
          value={formatNumber(learning?.totalStudents ?? 0)}
          icon={Users}
          tone="teal"
          href="/dashboard/classes"
        />
        <StatCard
          label={t("dashboardHome.monthlyIncome")}
          value={formatTHB(estimatedIncome, { fractionDigits: 0 })}
          icon={Wallet}
          tone="brand"
          hint={finance ? `${t("dashboardHome.rateHint")} ${formatRatePercent(finance.currentRate)}` : undefined}
          href="/dashboard/earnings"
        />
        <StatCard
          label={t("dashboardHome.weeklyClasses")}
          value={formatNumber(weeklyCount)}
          icon={Calendar}
          tone="orange"
          hint={weeklyCount > 0 ? t("dashboardHome.teachingThisWeek") : t("dashboardHome.noClassesThisWeek")}
          href="/dashboard/schedule"
        />
      </Grid>

      <SplitLayout
        main={
          <Section
            title={t("dashboardHome.recentClasses")}
            action={
              <Link href="/dashboard/classes" className="text-sm font-medium text-brand-fg hover:underline">
                {t("dashboardHome.viewAll")}
              </Link>
            }
          >
            {recentClasses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                tone="blue"
                title={t("dashboardHome.emptyClasses")}
                description={t("dashboardHome.emptyClassesHint")}
                action={createClassButton}
              />
            ) : (
              <ListGroup aria-label={t("dashboardHome.recentClasses")}>
                {recentClasses.map((cls) => {
                  const status = classStatusTone(cls.status);
                  return (
                    <ListRow
                      key={cls.id}
                      href={`/dashboard/classes/${cls.id}`}
                      leading={<IconTile icon={BookOpen} tone="blue" size="sm" />}
                      title={cls.name}
                      subtitle={
                        <>
                          {cls.nextSession}
                          <span aria-hidden="true"> · </span>
                          {formatNumber(cls.students ?? 0)} {t("dashboardHome.studentsUnit")}
                        </>
                      }
                      trailing={
                        <Chip tone={status.tone} size="sm">
                          {statusLabel[status.key]}
                        </Chip>
                      }
                    />
                  );
                })}
              </ListGroup>
            )}
          </Section>
        }
        side={
          <Section title={t("dashboardHome.nextRateGoal")}>
            <RateGoalCard goal={goal} estimatedIncome={estimatedIncome} />
          </Section>
        }
      />
    </Page>
  );
}
