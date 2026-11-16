import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CalendarCheck, Users } from "lucide-react";
import { Chip, EmptyState, ListRow, Notice, Page, PageHeader, UserAvatar } from "@/components/app";
import { formatPercent } from "@/lib/format";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { PanelCard } from "../components/PanelCard";
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
import { DateTile } from "./DateTile";
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
      leading={<DateTile date={meeting.date} />}
      title={`${meetingDateLabel(meeting.date)} · ${meetingTimeLabel(meeting.start, meeting.end)}`}
      subtitle={<span className="tabular">{countsLabel(meeting.counts)}</span>}
      meta={hasMeetingChips(meeting) ? <MeetingChips meeting={meeting} /> : undefined}
      trailing={
        <Chip tone={chip.tone} size="sm" dot>
          {chip.label()}
        </Chip>
      }
    />
  );
}

function StudentRow({ student }: { student: StudentStats }) {
  return (
    <ListRow
      leading={<UserAvatar name={student.name} src={student.avatarUrl} />}
      title={student.name || t("tutorClass.students.unnamed")}
      subtitle={
        <span className="tabular">{countsLabel({ present: student.present, late: student.late, absent: student.absent, unmarked: 0 })}</span>
      }
      lines={1}
      trailing={<span className="text-base font-semibold text-fg tabular">{formatPercent(student.rate)}</span>}
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
              mascot
              icon={CalendarCheck}
              title={t("tutorClass.attendance.emptyMeetingsTitle")}
              description={t("tutorClass.attendance.emptyMeetingsDescription")}
            />
          ) : (
            <PanelCard id="attendance-meetings-title" icon={CalendarCheck} tone="purple" title={t("tutorClass.attendance.viewMeetings")} flush>
              {meetings.map((meeting) => (
                <MeetingRow key={`${meeting.date}-${meeting.start}`} classId={classId} meeting={meeting} />
              ))}
            </PanelCard>
          )
        }
        students={
          students.length === 0 ? (
            <PanelCard id="attendance-students-title" icon={Users} tone="teal" title={t("tutorClass.attendance.viewStudents")} flush>
              <EmptyState compact icon={Users} title={t("tutorClass.attendance.emptyStudents")} />
            </PanelCard>
          ) : (
            <PanelCard id="attendance-students-title" icon={Users} tone="teal" title={t("tutorClass.attendance.viewStudents")} flush>
              {students.map((student) => (
                <StudentRow key={student.studentUserId} student={student} />
              ))}
              <p className="border-t border-hairline px-4 py-3 text-[0.8125rem] leading-[1.6] text-fg-muted md:px-5">
                {thaiCopy(t("tutorClass.attendance.rateNote"))}
              </p>
            </PanelCard>
          )
        }
      />
    </Page>
  );
}
