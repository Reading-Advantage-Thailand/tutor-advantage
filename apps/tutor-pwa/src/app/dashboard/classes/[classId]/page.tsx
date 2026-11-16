import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CalendarDays, Settings2 } from "lucide-react";
import { ListSkeleton, Notice, Page, Skeleton } from "@/components/app";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { LEARNING_URL } from "@/lib/service-urls";
import { classSetupHref, sumScheduledHours } from "@/lib/tutorClassFlow";
import type { BookOption } from "../components/book-options";
import { ArticleSelector } from "./components/ArticleSelector";
import { AttendanceEntryCard } from "./components/AttendanceEntryCard";
import { initialCycleId, openingCycleProgress, type BookCycle } from "./components/book-cycles";
import { ClassHeader } from "./components/ClassHeader";
import { ClassProgressCard } from "./components/ClassProgressCard";
import { ClassStatusToggle } from "./components/ClassStatusToggle";
import { CouponExtendButton } from "./components/CouponExtendButton";
import { DetailTabs, TabPanel } from "./components/DetailTabs";
import { DevClassSimulator } from "./components/DevClassSimulator";
import { MeetingUrlEditor } from "./components/MeetingUrlEditor";
import { PanelCard } from "./components/PanelCard";
import { ReferralLink } from "./components/ReferralLink";
import { RescheduleClassButton } from "./components/RescheduleClassButton";
import { StudentsPanel } from "./components/StudentsPanel";
import { VoicePracticeSection } from "./components/VoicePracticeSection";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function getClassData(classId: string, token: string) {
  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function getVoiceSummary(classId: string, token: string) {
  const res = await fetch(`${LEARNING_URL}/v1/classes/${classId}/voice-practice-summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { sessions?: any[] };
  return data.sessions || [];
}

/** Same requests as the getClassArticles / getBooks actions, made on the server for the first paint. */
async function getLessonData(classId: string, cycleId: string, token: string) {
  const query = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : "";
  const headers = { Authorization: `Bearer ${token}` };
  const [articles, books] = await Promise.all([
    fetch(`${LEARNING_URL}/v1/classes/${classId}/articles${query}`, { headers, cache: "no-store" })
      .then(async (res) => (res.ok ? (((await res.json()) as { articles?: any[] }).articles ?? []) : null))
      .catch(() => null),
    fetch(`${LEARNING_URL}/v1/books`, { headers, cache: "no-store" })
      .then(async (res) => (res.ok ? (((await res.json()) as { books?: BookOption[] }).books ?? []) : []))
      .catch(() => [] as BookOption[]),
  ]);
  return { articles, books };
}

async function LessonsBlock({ classId, bookCycles, token }: { classId: string; bookCycles: BookCycle[]; token: string }) {
  const { articles, books } = await getLessonData(classId, initialCycleId(bookCycles), token);
  return <ArticleSelector classId={classId} bookCycles={bookCycles} initialArticles={articles} books={books} />;
}

/** Lesson picker placeholder: the card header, the two controls and lesson rows. */
function LessonsSkeleton() {
  return (
    <div aria-hidden="true" className="ds-card overflow-hidden">
      <div className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-(--radius-tile)" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Skeleton className="h-11 rounded-(--radius-ctl)" />
          <Skeleton className="h-11 rounded-(--radius-ctl)" />
        </div>
      </div>
      <ListSkeleton rows={6} className="rounded-none border-x-0 border-b-0" />
    </div>
  );
}

function ScheduleCard({ cls, classId }: { cls: any; classId: string }) {
  const freeHours: number = cls.freeHours ?? 0;
  const remaining = Math.round((freeHours - sumScheduledHours(cls.scheduleData)) * 100) / 100;
  const startsAt = formatThaiDate(cls.startsAt);
  const endsAt = formatThaiDate(cls.endsAt);
  return (
    <PanelCard
      id="class-schedule-title"
      icon={CalendarDays}
      tone="purple"
      title={t("tutorClass.classes.scheduleLabel")}
      description={cls.schedule || t("tutorClass.classes.notSet")}
      bodyClassName="flex flex-col gap-3"
    >
      {startsAt || endsAt ? (
        <dl className="ds-well grid grid-cols-2 divide-x divide-hairline">
          <div className="min-w-0 px-3 py-2.5">
            <dt className="text-[0.8125rem] leading-[1.45] text-fg-muted">{t("tutorClass.classes.startsAt")}</dt>
            <dd className="mt-0.5 text-[0.9375rem] font-semibold text-fg tabular">{startsAt || t("tutorClass.classes.notSet")}</dd>
          </div>
          <div className="min-w-0 px-3 py-2.5">
            <dt className="text-[0.8125rem] leading-[1.45] text-fg-muted">{t("tutorClass.classes.endsAt")}</dt>
            <dd className="mt-0.5 text-[0.9375rem] font-semibold text-fg tabular">{endsAt || t("tutorClass.classes.notSet")}</dd>
          </div>
        </dl>
      ) : null}
      {freeHours > 0 ? (
        remaining > 0 ? (
          <Notice tone="warning" title={t("tutorClass.detail.couponUnscheduledWarning")}>
            {t("tutorClass.detail.remainingHoursLabel")}: {remaining} {t("tutorClass.detail.freeHoursUnit")}
          </Notice>
        ) : (
          <Notice tone="brand">
            {t("tutorClass.detail.freeHoursLabel")}: {freeHours} {t("tutorClass.detail.freeHoursUnit")}
          </Notice>
        )
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <RescheduleClassButton
          classId={classId}
          className={cls.name}
          currentSchedule={cls.schedule}
          scheduleData={cls.scheduleData}
          initialStartsAt={cls.startsAt}
          freeHours={freeHours}
        />
        <CouponExtendButton classId={classId} />
      </div>
    </PanelCard>
  );
}

// In Next.js 15, `params` is a Promise
export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { classId } = await params;
  const { tab } = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const [response, voiceSessions] = await Promise.all([getClassData(classId, token), getVoiceSummary(classId, token)]);
  if (!response || !response.class) {
    return notFound();
  }

  const cls = response.class;
  const bookCycles: BookCycle[] = cls.bookCycles || [];
  const enrolledCount: number | undefined = cls.students ?? cls.enrolledStudents?.length;
  // Same cycle and total as ClassProgressCard, so the tab badge and the card agree.
  const lessonsCount = openingCycleProgress(bookCycles, cls.articleCount)?.progress.totalArticles;

  return (
    <Page>
      <ClassHeader
        classId={classId}
        name={cls.name}
        book={cls.book}
        level={cls.cefr}
        schedule={cls.schedule}
        status={<ClassStatusToggle classId={classId} initialStatus={cls.status} />}
        seats={{ students: cls.students ?? 0, max: cls.maxStudents ?? 0 }}
      />

      {cls.setupRequired ? (
        <Notice
          tone="warning"
          icon={Settings2}
          href={classSetupHref(classId)}
          title={t("tutorClass.setup.detailNoticeTitle")}
        >
          {t("tutorClass.setup.detailNoticeBody")}
        </Notice>
      ) : null}

      <DetailTabs
        initial={tab === "students" ? "students" : undefined}
        counts={{ lessons: lessonsCount, students: enrolledCount }}
      >
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_384px]">
          <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
            <TabPanel tab="lessons">
              <Suspense fallback={<LessonsSkeleton />}>
                <LessonsBlock classId={classId} bookCycles={bookCycles} token={token} />
              </Suspense>
            </TabPanel>
            <TabPanel tab="students">
              <StudentsPanel
                enrolledStudents={cls.enrolledStudents}
                students={cls.students}
                maxStudents={cls.maxStudents}
              />
              <Suspense fallback={<ListSkeleton rows={2} />}>
                <AttendanceEntryCard classId={classId} token={token} />
              </Suspense>
              <VoicePracticeSection sessions={voiceSessions} />
            </TabPanel>
            {process.env.NODE_ENV === "development" ? (
              <TabPanel tab="overview">
                <DevClassSimulator classId={classId} />
              </TabPanel>
            ) : null}
          </div>
          {/* The panel is the grid item, so a hidden overview tab leaves no gap on phones. */}
          <TabPanel tab="overview" className="max-lg:order-first">
            <aside className="flex min-w-0 flex-col gap-5 lg:gap-6">
              <ClassProgressCard bookCycles={bookCycles} articleCount={cls.articleCount} />
              <ScheduleCard cls={cls} classId={classId} />
              <MeetingUrlEditor classId={classId} initialUrl={cls.meetingUrl} />
              <ReferralLink referralLink={cls.referralLink} />
            </aside>
          </TabPanel>
        </div>
      </DetailTabs>
    </Page>
  );
}
