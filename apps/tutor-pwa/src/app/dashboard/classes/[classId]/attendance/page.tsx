import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CalendarCheck, Users } from "lucide-react";
import { Chip, EmptyState, ListGroup, ListRow, Notice, Page, PageHeader, UserAvatar } from "@/components/app";
import { formatPercent } from "@/lib/format";
import { t } from "@/lib/i18n";
import { AdhocMeetingButton } from "./AdhocMeetingButton";
import { loadAttendanceOverview } from "./attendance-server";
import {
  attendanceMeetingHref,
  classStudentsHref,
  countsLabel,
  hasMeetingChips,
  meetingDateLabel,
  meetingProgress,
  meetingTimeLabel,
  type MeetingProgress,
  type MeetingSummary,
  type StudentStats,
} from "./attendanceModel";
import { HistoryPanels } from "./HistoryPanels";
import { MeetingChips } from "./MeetingChips";

const PROGRESS_CHIP: Record<MeetingProgress, { tone: "neutral" | "warning" | "success"; label: () => string }> = {
  unmarked: { tone: "neutral", label: () => t("tutorClass.attendance.unmarked") },
  partial: { tone: "warning", label: () => t("tutorClass.attendance.partial") },
  complete: { tone: "success", label: () => t("tutorClass.attendance.complete") },
};

function MeetingRow({ classId, meeting }: { classId: string; meeting: MeetingSummary }) {
  const chip = PROGRESS_CHIP[meetingProgress(meeting)];
  return (
    <ListRow
      href={attendanceMeetingHref(classId, meeting)}
      title={`${meetingDateLabel(meeting.date)} · ${meetingTimeLabel(meeting.start, meeting.end)}`}
      subtitle={countsLabel(meeting.counts)}
      meta={hasMeetingChips(meeting) ? <MeetingChips meeting={meeting} /> : undefined}
      trailing={
        <Chip tone={chip.tone} size="sm">
          {chip.label()}
        </Chip>
      }
    />
  );
}

function StudentRow({ student }: { student: StudentStats }) {
  return (
    <ListRow
      leading={<UserAvatar name={student.name} src={student.avatarUrl} size="sm" />}
      title={student.name || t("tutorClass.students.unnamed")}
      subtitle={countsLabel({ present: student.present, late: student.late, absent: student.absent, unmarked: 0 })}
      lines={1}
      trailing={<span className="font-semibold text-fg tabular">{formatPercent(student.rate)}</span>}
    />
  );
}

export default async function AttendanceHistoryPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const result = await loadAttendanceOverview(classId, token);
  if (result.kind === "notFound") return notFound();
  if (result.kind === "failed") throw new Error("Could not load attendance");

  const header = {
    title: t("tutorClass.attendance.historyTitle"),
    backHref: classStudentsHref(classId),
    backLabel: t("tutorClass.attendance.backToClass"),
  };

  if (result.kind === "unavailable") {
    return (
      <Page width="medium">
        <PageHeader {...header} />
        <Notice tone="info">{t("tutorClass.attendance.errorNotAvailable")}</Notice>
      </Page>
    );
  }

  const { meetings, students } = result.data;

  return (
    <Page width="medium">
      <PageHeader
        {...header}
        description={t("tutorClass.attendance.historyDescription")}
        actions={<AdhocMeetingButton classId={classId} />}
      />
      <HistoryPanels
        meetings={
          meetings.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={t("tutorClass.attendance.emptyMeetingsTitle")}
              description={t("tutorClass.attendance.emptyMeetingsDescription")}
            />
          ) : (
            <ListGroup header={t("tutorClass.attendance.viewMeetings")}>
              {meetings.map((meeting) => (
                <MeetingRow key={`${meeting.date}-${meeting.start}`} classId={classId} meeting={meeting} />
              ))}
            </ListGroup>
          )
        }
        students={
          students.length === 0 ? (
            <EmptyState compact icon={Users} title={t("tutorClass.attendance.emptyStudents")} />
          ) : (
            <ListGroup header={t("tutorClass.attendance.viewStudents")} footer={t("tutorClass.attendance.rateNote")}>
              {students.map((student) => (
                <StudentRow key={student.studentUserId} student={student} />
              ))}
            </ListGroup>
          )
        }
      />
    </Page>
  );
}
