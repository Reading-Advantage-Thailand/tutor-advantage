import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Notice, Page, PageHeader, StatStrip } from "@/components/app";
import { Button } from "@/components/ui/button";
import VerificationBanner from "@/components/dashboard/verification-banner";
import { RoleUpgradeBanner } from "@/components/dashboard/role-upgrade-banner";
import { formatNumber, formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { LEARNING_URL } from "@/lib/service-urls";
import { getCurrentUserAction } from "./actions";
import { DocumentExpiryNotice } from "./settings/components/DocumentExpiryNotice";
import { HomeWallet } from "./_home/HomeWallet";
import { NextClass } from "./_home/NextClass";
import { RecentClasses } from "./_home/RecentClasses";
import { SetupClassesNotice } from "./_home/SetupClassesNotice";
import { TodaySessions } from "./_home/TodaySessions";
import { WeekGrid } from "./_home/WeekGrid";
import { fillTemplate } from "./_shared/text";
import {
  computeRateGoal,
  computeWalletBreakdown,
  signInSetupRedirect,
  type FinanceSummary,
  type LearningSummary,
  type RecentClass,
} from "./_home/home-data";
import { buildHomeSchedule, greetingPart, openSeats, teacherNameSuffix, type HomeClass } from "./_home/home-schedule";

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

/**
 * The tutor's classes with their schedules: the same learning-service call
 * the schedule page makes (GET /v1/classes). Feeds the next-class card,
 * today's sessions and the week grid; null when it fails.
 */
async function getClassesData(token: string): Promise<HomeClass[] | null> {
  const data = await fetchJsonOrNull<{ classes?: HomeClass[] }>(`${LEARNING_URL}/v1/classes`, token);
  return data ? (data.classes ?? []) : null;
}

const greetingKey = {
  morning: "dashboardHome.greetMorning",
  afternoon: "dashboardHome.greetAfternoon",
  evening: "dashboardHome.greetEvening",
} as const;

/**
 * Tutor Home (patterns.md T1). Phone: greeting → notices → wallet hero →
 * next class (the one primary) → stat strip → today's sessions → recent
 * classes. Desktop ≥ 1024: row 1 (2fr : 1fr) wallet + stat strip | next
 * class; row 2 today + week grid | recent classes (side by side from
 * 1280; recent classes stack under at 1024–1279). DOM order is the phone
 * order, so focus order follows what the tutor reads first. When the class
 * list fails, the schedule blocks say so in place (the page-level notice
 * keeps its original learning/finance condition).
 */
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ signedIn?: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const [learning, finance, user, classes, { signedIn }] = await Promise.all([
    getLearningData(token),
    getFinanceData(token),
    getCurrentUserAction(),
    getClassesData(token),
    searchParams,
  ]);

  const classesNeedingSetup = learning?.classesNeedingSetup ?? [];
  const setupRedirect = signInSetupRedirect(signedIn, classesNeedingSetup);
  if (setupRedirect) redirect(setupRedirect);

  const now = new Date();
  const weeklyCount = learning?.classesThisWeek ?? 0;
  const goal = computeRateGoal(finance);
  const estimatedIncome = finance?.estimatedCommissionTHB ?? 0;
  const breakdown = computeWalletBreakdown(finance);
  const recentClasses: RecentClass[] = learning?.recentClasses ?? [];
  const schedule = buildHomeSchedule(classes, now);
  const hasClasses = (classes?.length ?? 0) > 0 || recentClasses.length > 0;

  const displayName: string | null =
    typeof user?.displayName === "string" ? user.displayName : typeof user?.name === "string" ? user.name : null;
  const nameSuffix = teacherNameSuffix(displayName);
  const greeting = (
    <>
      <span className="whitespace-nowrap">{t(greetingKey[greetingPart(now)])}</span>
      {nameSuffix ? (
        <>
          {" "}
          {/* A display name can be an email (no break point): let it break anywhere rather than overflow. */}
          <span className="[overflow-wrap:anywhere]">{fillTemplate(t("dashboardHome.greetTeacher"), { name: nameSuffix })}</span>
        </>
      ) : null}
    </>
  );

  const createClassButton = (
    <Button id="btn-create-class" variant="outline" render={<Link href="/dashboard/classes/new" />} nativeButton={false}>
      <Plus aria-hidden="true" />
      {t("tutorClass.classes.create")}
    </Button>
  );

  const todayCount = schedule.today.length;

  return (
    <Page>
      <PageHeader
        title={greeting}
        appBarTitle={t("dashboardHome.title")}
        mobileTitle="inline"
        eyebrow={<span className="hidden lg:inline">{formatThaiDate(now, "full")}</span>}
        description={t("dashboardHome.subtitle")}
        actions={createClassButton}
        appBarAction={{ href: "/dashboard/classes/new", label: t("tutorClass.classes.create") }}
        // Phones create from the app bar "+", so the header button (and its empty row) hides there.
        // 768px in px, like the app bar's own media query (globals.css): a rem breakpoint (max-md)
        // moves with the browser's default font size and would leave a width with neither action.
        className="max-[768px]:[&>div:last-child]:hidden"
      />

      <SetupClassesNotice classes={classesNeedingSetup} />
      <Suspense>
        <RoleUpgradeBanner />
      </Suspense>
      <VerificationBanner user={user ?? undefined} />
      <DocumentExpiryNotice identity={user?.identity} href="/dashboard/settings#verify" showPayoutBlock />

      {!learning || !finance ? (
        <Notice
          tone="warning"
          role="status"
          action={
            // A full reload re-runs every server fetch on this page.
            <Button variant="outline" size="sm" render={<a href="/dashboard" />} nativeButton={false}>
              {t("shell.retry")}
            </Button>
          }
        >
          {t("dashboardHome.dataUnavailable")}
        </Notice>
      ) : null}

      {/* Row 1: wallet + stats | next class (phones: wallet, next, stats). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-5">
        <HomeWallet
          goal={goal}
          estimatedIncome={estimatedIncome}
          hasFinance={Boolean(finance)}
          breakdown={breakdown}
          className="lg:col-start-1 lg:row-start-1"
        />
        <NextClass
          next={schedule.next}
          hasClasses={hasClasses}
          unavailable={classes === null}
          className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
        />
        <StatStrip
          aria-label={t("dashboardHome.statsLabel")}
          // Labels, values and hints line up across cells (shared subgrid) whether or not a
          // cell has a hint or a label wraps (320px); stretched to the next card's height on
          // desktop, the spare height is split above and below.
          align="center"
          className="lg:col-start-1 lg:row-start-2"
          items={[
            {
              label: t("dashboardHome.openClasses"),
              value: formatNumber(learning?.openClasses ?? 0),
              hint:
                classes && (learning?.openClasses ?? 0) > 0
                  ? fillTemplate(t("dashboardHome.seatsLeft"), { n: formatNumber(openSeats(classes)) })
                  : undefined,
              href: "/dashboard/classes",
            },
            {
              label: t("dashboardHome.totalStudents"),
              value: formatNumber(learning?.totalStudents ?? 0),
              href: "/dashboard/classes",
            },
            {
              label: t("dashboardHome.weeklyClasses"),
              value: formatNumber(weeklyCount),
              // The strip balances its hints (no one-word last line in a narrow cell).
              hint:
                todayCount > 0
                  ? fillTemplate(t("dashboardHome.todayCount"), { n: formatNumber(todayCount) })
                  : weeklyCount > 0
                    ? t("dashboardHome.teachingThisWeek")
                    : t("dashboardHome.noClassesThisWeek"),
              href: "/dashboard/schedule",
            },
          ]}
        />
      </div>

      {/* Row 2: today + week grid (desktop) | recent classes. The 2fr : 1fr
          split starts at xl: at 1024–1279 the 1fr column is too narrow for a
          class name beside its status chip, so recent classes stack under. */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <TodaySessions schedule={schedule} unavailable={classes === null} />
          <WeekGrid schedule={schedule} unavailable={classes === null} className="max-lg:hidden" />
        </div>
        <RecentClasses recentClasses={recentClasses} classes={classes} summaryFailed={!learning} />
      </div>
    </Page>
  );
}
