import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Play, Users } from "lucide-react";
import {
  Card,
  CardHeader,
  CardSkeleton,
  Chip,
  DescriptionList,
  IconTile,
  Notice,
  Page,
  PageHeader,
} from "@/components/app";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { LEARNING_URL } from "@/lib/service-urls";
import { sumScheduledHours } from "@/lib/tutorClassFlow";
import type { BookOption } from "../components/book-options";
import { ArticleSelector } from "./components/ArticleSelector";
import { initialCycleId, type BookCycle } from "./components/book-cycles";
import { ClassStatusToggle } from "./components/ClassStatusToggle";
import { CouponExtendButton } from "./components/CouponExtendButton";
import { DetailTabs, TabPanel } from "./components/DetailTabs";
import { DevClassSimulator } from "./components/DevClassSimulator";
import { MeetingUrlEditor } from "./components/MeetingUrlEditor";
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

function ScheduleCard({ cls, classId }: { cls: any; classId: string }) {
  const freeHours: number = cls.freeHours ?? 0;
  const remaining = Math.round((freeHours - sumScheduledHours(cls.scheduleData)) * 100) / 100;
  const startsAt = formatThaiDate(cls.startsAt);
  const endsAt = formatThaiDate(cls.endsAt);
  return (
    <Card as="section" aria-labelledby="class-schedule-title">
      <CardHeader
        icon={<IconTile icon={CalendarDays} size="sm" tone="blue" />}
        title={<span id="class-schedule-title">{t("tutorClass.classes.scheduleLabel")}</span>}
        description={cls.schedule || t("tutorClass.classes.notSet")}
      />
      {startsAt || endsAt ? (
        <DescriptionList
          className="mb-4 grid-cols-2 md:grid-cols-2"
          items={[
            { label: t("tutorClass.classes.startsAt"), value: startsAt || t("tutorClass.classes.notSet") },
            { label: t("tutorClass.classes.endsAt"), value: endsAt || t("tutorClass.classes.notSet") },
          ]}
        />
      ) : null}
      {freeHours > 0 ? (
        remaining > 0 ? (
          <Notice tone="warning" title={t("tutorClass.detail.couponUnscheduledWarning")} className="mb-4">
            {t("tutorClass.detail.remainingHoursLabel")}: {remaining} {t("tutorClass.detail.freeHoursUnit")}
          </Notice>
        ) : (
          <Notice tone="brand" className="mb-4">
            {t("tutorClass.detail.freeHoursLabel")}: {freeHours} {t("tutorClass.detail.freeHoursUnit")}
          </Notice>
        )
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
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
    </Card>
  );
}

// In Next.js 15, `params` is a Promise
export default async function ClassDetailPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const [response, voiceSessions] = await Promise.all([getClassData(classId, token), getVoiceSummary(classId, token)]);
  if (!response || !response.class) {
    return notFound();
  }

  const cls = response.class;
  const bookCycles: BookCycle[] = cls.bookCycles || [];
  const description = [cls.book, cls.schedule].filter(Boolean).join(" · ");

  return (
    <Page>
      <PageHeader
        title={cls.name}
        mobileTitle="inline"
        appBarTitle={t("tutorClass.view.appBarTitle")}
        backHref="/dashboard/classes"
        backLabel={t("tutorClass.classes.title")}
        description={description}
        meta={
          <>
            <ClassStatusToggle classId={classId} initialStatus={cls.status} />
            <Chip icon={Users} tone="neutral">
              {cls.students ?? 0}/{cls.maxStudents ?? 0} {t("tutorClass.classes.peopleUnit")}
            </Chip>
          </>
        }
        actions={
          <Link
            href={`/lesson/${classId}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-solid px-4 text-sm font-semibold text-on-brand shadow-xs outline-none hover:bg-brand-solid-pressed focus-visible:ring-3 focus-visible:ring-ring/40 max-lg:hidden"
          >
            <Play aria-hidden="true" className="size-4" />
            {t("tutorClass.view.startTeaching")}
          </Link>
        }
      />

      <DetailTabs>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            <TabPanel tab="lessons">
              <Suspense fallback={<CardSkeleton lines={8} />}>
                <LessonsBlock classId={classId} bookCycles={bookCycles} token={token} />
              </Suspense>
            </TabPanel>
            <TabPanel tab="students">
              <VoicePracticeSection sessions={voiceSessions} />
            </TabPanel>
            {process.env.NODE_ENV === "development" ? (
              <TabPanel tab="overview">
                <DevClassSimulator classId={classId} />
              </TabPanel>
            ) : null}
          </div>
          <aside className="flex min-w-0 flex-col gap-6 max-lg:order-first">
            <TabPanel tab="overview">
              <ScheduleCard cls={cls} classId={classId} />
              <MeetingUrlEditor classId={classId} initialUrl={cls.meetingUrl} />
              <ReferralLink referralLink={cls.referralLink} />
            </TabPanel>
            <TabPanel tab="students">
              <StudentsPanel
                enrolledStudents={cls.enrolledStudents}
                students={cls.students}
                maxStudents={cls.maxStudents}
              />
            </TabPanel>
          </aside>
        </div>
      </DetailTabs>
    </Page>
  );
}
