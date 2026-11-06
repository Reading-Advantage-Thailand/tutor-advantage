"use client";

import { use } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardCheck, FileQuestion, Users } from "lucide-react";
import {
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  Page,
  PageHeader,
  PageHeaderSkeleton,
  Section,
  TableSkeleton,
  useAdminSession,
  UserAvatar,
  type DataTableColumn,
} from "@/components/app";
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

function noteLabel(note: MeetingNote): string {
  if (note.kind === "adhoc") return t("classes.attendance.noteAdhoc");
  if (note.kind === "moved") return t("classes.attendance.noteMoved", { time: note.from });
  return t("classes.attendance.noteOffSchedule");
}

function countColumn<T>(key: string, header: string, value: (row: T) => number): DataTableColumn<T> {
  return { key, header, align: "right", cell: (row) => <span className="tabular">{formatNumber(value(row))}</span> };
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
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar name={row.name ?? ""} src={row.avatarUrl} size="sm" />
            <Link href={studentProfileHref(row.studentUserId)} className="block max-w-64 truncate text-fg hover:underline" title={name}>
              {name}
            </Link>
          </span>
        );
      },
    },
    countColumn("present", statusLabel("attendance", "PRESENT"), (row) => row.present),
    countColumn("late", statusLabel("attendance", "LATE"), (row) => row.late),
    countColumn("absent", statusLabel("attendance", "ABSENT"), (row) => row.absent),
    {
      key: "rate",
      header: t("classes.attendance.colRate"),
      align: "right",
      mobile: "trailing",
      cell: (row) => <span className="tabular">{formatPercent(row.rate)}</span>,
    },
  ];

  return (
    <DataTable
      caption={t("classes.attendance.studentsTitle")}
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.studentUserId}
      empty={<EmptyState compact icon={Users} title={t("classes.attendance.studentsEmpty")} />}
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
            <span className="whitespace-nowrap font-medium text-fg">{meetingDateLabel(row.date)}</span>
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
    countColumn("present", statusLabel("attendance", "PRESENT"), (row) => row.counts.present),
    countColumn("late", statusLabel("attendance", "LATE"), (row) => row.counts.late),
    countColumn("absent", statusLabel("attendance", "ABSENT"), (row) => row.counts.absent),
    countColumn("unmarked", t("classes.attendance.colUnmarked"), (row) => row.counts.unmarked),
  ];

  return (
    <DataTable
      caption={t("classes.attendance.meetingsTitle")}
      columns={columns}
      rows={rows}
      getRowKey={meetingRowKey}
      empty={<EmptyState compact icon={CalendarDays} title={t("classes.attendance.meetingsEmpty")} />}
    />
  );
}

export default function ClassAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useAdminSession();
  const key = me ? classAttendanceKey(me.userId, id) : null;
  const { data, error, refetch } = useCachedResource(key, () => api.get<AdminClassAttendanceResponse>(classAttendancePath(id)));

  const backProps = { backHref: "/classes", backLabel: t("classes.attendance.backToList") };

  if (error && !data) {
    const failure = attendanceLoadFailure(error);
    return (
      <Page>
        <PageHeader title={t("classes.attendance.pageTitle")} {...backProps} />
        {failure === "notFound" ? (
          <EmptyState icon={FileQuestion} title={t("classes.attendance.notFoundTitle")} description={t("classes.attendance.notFoundDescription")} />
        ) : failure === "notAvailable" ? (
          <EmptyState
            icon={ClipboardCheck}
            title={t("classes.attendance.notAvailableTitle")}
            description={t("classes.attendance.notAvailableDescription")}
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
        <PageHeaderSkeleton actions={false} />
        <TableSkeleton />
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
      <Section title={t("classes.attendance.studentsTitle")} description={t("classes.attendance.studentsDescription")}>
        <StudentsTable rows={data.students} />
      </Section>
      <Section title={t("classes.attendance.meetingsTitle")} description={t("classes.attendance.meetingsDescription")}>
        <MeetingsTable rows={data.meetings} />
      </Section>
    </Page>
  );
}
