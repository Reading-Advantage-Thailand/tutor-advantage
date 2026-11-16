"use client";

import { use } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardCheck, ClipboardX, FileQuestion, UserCheck, Users } from "lucide-react";
import {
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  IdentityCell,
  KpiStrip,
  LoadingAnnouncement,
  Page,
  PageHeader,
  PageHeaderSkeleton,
  Section,
  Skeleton,
  StatCard,
  StatGridSkeleton,
  TableSkeleton,
  useAdminSession,
  UserAvatar,
  type DataTableColumn,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatPercent } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel, type StatusTone } from "@/lib/status";
import {
  attendanceLoadFailure,
  classAttendanceKey,
  classAttendancePath,
  meetingDateLabel,
  meetingNote,
  meetingProgress,
  meetingRowKey,
  meetingTimeLabel,
  studentProfileHref,
  type AdminClassAttendanceResponse,
  type AttendanceMeetingSummary,
  type AttendanceStudentStats,
  type MeetingNote,
  type MeetingProgress,
} from "../../attendanceModel";
import "@/locales/th/classes";

const PROGRESS: Record<MeetingProgress, { label: () => string; tone: StatusTone }> = {
  none: { label: () => t("classes.attendance.progressNone"), tone: "warning" },
  partial: { label: () => t("classes.attendance.progressPartial"), tone: "info" },
  complete: { label: () => t("classes.attendance.progressComplete"), tone: "success" },
};

type AttendanceKey = "PRESENT" | "LATE" | "ABSENT";

/** The status dot in the count column headers: colour + dot + word, like the chips. */
const DOT: Record<AttendanceKey, string> = {
  PRESENT: "bg-success-solid",
  LATE: "bg-warning-solid",
  ABSENT: "bg-danger-solid",
};

function noteLabel(note: MeetingNote): string {
  if (note.kind === "adhoc") return t("classes.attendance.noteAdhoc");
  if (note.kind === "moved") return t("classes.attendance.noteMoved", { time: note.from });
  return t("classes.attendance.noteOffSchedule");
}

function countColumn<T>(key: string, header: string, value: (row: T) => number, dot?: AttendanceKey): DataTableColumn<T> {
  return {
    key,
    header: dot ? (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${DOT[dot]}`} />
        {header}
      </span>
    ) : (
      header
    ),
    label: header,
    align: "right",
    cell: (row) => <span className="tabular">{formatNumber(value(row))}</span>,
  };
}

/** "86%" with a small decorative bar (the number is the value; the bar only helps scanning). */
function RateCell({ rate }: { rate: number | null }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      {rate !== null ? (
        <span aria-hidden="true" className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-track md:block">
          <span className="block h-full w-full origin-left rounded-full bg-brand-vivid" style={{ transform: `scaleX(${Math.min(1, Math.max(0, rate))})` }} />
        </span>
      ) : null}
      <span className="tabular">{formatPercent(rate)}</span>
    </span>
  );
}

function StudentsTable({ rows }: { rows: AttendanceStudentStats[] }) {
  const columns: DataTableColumn<AttendanceStudentStats>[] = [
    {
      key: "name",
      header: t("classes.attendance.colStudent"),
      sticky: true,
      mobile: "primary",
      cell: (row) => {
        const name = row.name || t("classes.attendance.noName");
        return (
          <IdentityCell
            leading={<UserAvatar name={row.name ?? ""} src={row.avatarUrl} seed={row.studentUserId} size="sm" decorative />}
            title={name}
            name={
              // The name is cut inside the link (IdentityCell does not clip a link), so the touch ::after stays 44px tall.
              <Link
                href={studentProfileHref(row.studentUserId)}
                className="relative block min-w-0 hover:underline pointer-coarse:after:absolute pointer-coarse:after:-inset-y-3 pointer-coarse:after:inset-x-0"
                title={name}
              >
                <span className="block truncate">{name}</span>
              </Link>
            }
            className="max-w-72"
          />
        );
      },
    },
    countColumn("present", statusLabel("attendance", "PRESENT"), (row) => row.present, "PRESENT"),
    countColumn("late", statusLabel("attendance", "LATE"), (row) => row.late, "LATE"),
    countColumn("absent", statusLabel("attendance", "ABSENT"), (row) => row.absent, "ABSENT"),
    {
      key: "rate",
      header: t("classes.attendance.colRate"),
      align: "right",
      mobile: "trailing",
      cell: (row) => <RateCell rate={row.rate} />,
    },
  ];

  return (
    <DataTable
      caption={t("classes.attendance.studentsTitle")}
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.studentUserId}
      empty={<EmptyState as="h3" icon={Users} title={t("classes.attendance.studentsEmpty")} />}
    />
  );
}

function MeetingsTable({ rows }: { rows: AttendanceMeetingSummary[] }) {
  const columns: DataTableColumn<AttendanceMeetingSummary>[] = [
    {
      key: "date",
      header: t("classes.attendance.colDate"),
      sticky: true,
      mobile: "primary",
      cell: (row) => {
        const note = meetingNote(row);
        return (
          <span className="flex min-w-0 flex-col items-start gap-1">
            <span className="font-medium whitespace-nowrap text-fg tabular">{meetingDateLabel(row.date)}</span>
            {note ? (
              <Chip tone="neutral" size="sm">
                {noteLabel(note)}
              </Chip>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "time",
      header: t("classes.attendance.colTime"),
      mobile: "secondary",
      cell: (row) => <span className="whitespace-nowrap tabular">{meetingTimeLabel(row)}</span>,
    },
    {
      key: "progress",
      header: t("classes.attendance.colProgress"),
      mobile: "trailing",
      cell: (row) => {
        const progress = PROGRESS[meetingProgress(row)];
        return (
          <Chip tone={progress.tone} size="sm">
            {progress.label()}
          </Chip>
        );
      },
    },
    countColumn("present", statusLabel("attendance", "PRESENT"), (row) => row.counts.present, "PRESENT"),
    countColumn("late", statusLabel("attendance", "LATE"), (row) => row.counts.late, "LATE"),
    countColumn("absent", statusLabel("attendance", "ABSENT"), (row) => row.counts.absent, "ABSENT"),
    countColumn("unmarked", t("classes.attendance.colUnmarked"), (row) => row.counts.unmarked),
  ];

  return (
    <DataTable
      caption={t("classes.attendance.meetingsTitle")}
      columns={columns}
      rows={rows}
      getRowKey={meetingRowKey}
      empty={<EmptyState as="h3" icon={CalendarDays} tone="purple" title={t("classes.attendance.meetingsEmpty")} />}
    />
  );
}

/**
 * Totals for the summary strip, from the meetings already on the page:
 * how many meetings are marked (complete / partial / not yet) and the class
 * attendance rate on the same rule as the per-student rate (present + late
 * over marked marks; unmarked marks are left out).
 */
function summarize(meetings: AttendanceMeetingSummary[]) {
  const progress = { none: 0, partial: 0, complete: 0 } satisfies Record<MeetingProgress, number>;
  const marks = { present: 0, late: 0, absent: 0 };
  for (const meeting of meetings) {
    progress[meetingProgress(meeting)] += 1;
    marks.present += meeting.counts.present;
    marks.late += meeting.counts.late;
    marks.absent += meeting.counts.absent;
  }
  const marked = marks.present + marks.late + marks.absent;
  return { progress, marks, rate: marked > 0 ? (marks.present + marks.late) / marked : null };
}

function AttendanceSummary({ data }: { data: AdminClassAttendanceResponse }) {
  const { progress, marks, rate } = summarize(data.meetings);
  const total = data.meetings.length;
  const share = (count: number) => (total > 0 ? (count / total) * 100 : 0);
  const progressWords = (["complete", "partial", "none"] as const)
    .map((key) => `${PROGRESS[key].label()} ${formatNumber(progress[key])}`)
    .join(" · ");
  // One no-wrap phrase per status ("ขาดเรียน 2" never breaks inside the word at 390).
  const markWords = (["PRESENT", "LATE", "ABSENT"] as const).map((key, index) => (
    <span key={key}>
      {index > 0 ? " · " : null}
      <span className="whitespace-nowrap">
        {statusLabel("attendance", key)} {formatNumber(marks[key.toLowerCase() as "present" | "late" | "absent"])}
      </span>
    </span>
  ));
  return (
    <KpiStrip aria-label={t("classes.attendance.statsLabel")}>
      <StatCard label={t("classes.attendance.colStudent")} value={formatNumber(data.students.length)} icon={Users} tone="blue" />
      <StatCard
        label={t("classes.attendance.statMeetings")}
        value={formatNumber(total)}
        icon={CalendarDays}
        tone="purple"
        hint={t("classes.attendance.statMeetingsHint", { count: formatNumber(progress.complete) })}
        // Partial in blue, like the info chips in the meetings table (amber means "not marked" here).
        bar={
          total > 0
            ? [
                { value: share(progress.complete), tone: "brand" },
                { value: share(progress.partial), tone: "chart-2" },
              ]
            : undefined
        }
        barLabel={progressWords}
      />
      <StatCard
        label={t("classes.attendance.progressNone")}
        value={formatNumber(progress.none)}
        icon={ClipboardX}
        tone="amber"
        hint={t("classes.attendance.statUnmarkedHint", { count: formatNumber(progress.partial) })}
      />
      <StatCard label={t("classes.attendance.colRate")} value={formatPercent(rate)} icon={UserCheck} tone="teal" hint={markWords} />
    </KpiStrip>
  );
}

export default function ClassAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useAdminSession();
  const key = me ? classAttendanceKey(me.userId, id) : null;
  const { data, error, refetch } = useCachedResource(key, () => api.get<AdminClassAttendanceResponse>(classAttendancePath(id)));

  const backProps = { backHref: "/classes", backLabel: t("classes.attendance.backToList") };
  const backAction = (
    <Button asChild variant="outline">
      <Link href={backProps.backHref}>{backProps.backLabel}</Link>
    </Button>
  );

  if (error && !data) {
    const failure = attendanceLoadFailure(error);
    return (
      <Page>
        <PageHeader title={t("classes.attendance.pageTitle")} {...backProps} />
        {failure === "notFound" ? (
          <EmptyState
            icon={FileQuestion}
            title={t("classes.attendance.notFoundTitle")}
            description={t("classes.attendance.notFoundDescription")}
            action={backAction}
          />
        ) : failure === "notAvailable" ? (
          <EmptyState
            icon={ClipboardCheck}
            tone="amber"
            title={t("classes.attendance.notAvailableTitle")}
            description={t("classes.attendance.notAvailableDescription")}
            action={backAction}
          />
        ) : (
          <ErrorState onRetry={refetch} />
        )}
      </Page>
    );
  }

  if (!data) {
    return (
      <Page>
        <LoadingAnnouncement />
        <PageHeaderSkeleton actions={false} />
        <StatGridSkeleton />
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <TableSkeleton rows={6} columns={5} />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={t("classes.attendance.pageTitle")}
        description={t("classes.attendance.pageDescription", {
          title: data.class.title,
          tutor: data.class.tutorName || t("classes.noTutor"),
        })}
        {...backProps}
      />
      <AttendanceSummary data={data} />
      <Section title={t("classes.attendance.studentsTitle")} description={t("classes.attendance.studentsDescription")}>
        <StudentsTable rows={data.students} />
      </Section>
      <Section title={t("classes.attendance.meetingsTitle")} description={t("classes.attendance.meetingsDescription")}>
        <MeetingsTable rows={data.meetings} />
      </Section>
    </Page>
  );
}
