import { ListGroup, ListRow } from "@/components/app";
import { t } from "@/lib/i18n";
import { loadAttendanceOverview } from "../attendance/attendance-server";
import {
  attendanceHistoryHref,
  attendanceMeetingHref,
  latestUnmarkedMeeting,
  meetingDateLabel,
  meetingTimeLabel,
} from "../attendance/attendanceModel";

/**
 * "เช็กชื่อ" entry on the class page. Server component, streamed in Suspense.
 * Classes without attendance (demo, setup pending) show nothing. If the load
 * fails the page stays up and only the link to the history remains.
 */
export async function AttendanceEntryCard({ classId, token }: { classId: string; token: string }) {
  const result = await loadAttendanceOverview(classId, token);
  if (result.kind === "unavailable" || result.kind === "notFound") return null;

  const latest = result.kind === "ok" ? latestUnmarkedMeeting(result.data.meetings) : null;

  return (
    <ListGroup header={t("tutorClass.attendance.title")}>
      {latest ? (
        <ListRow
          href={attendanceMeetingHref(classId, latest)}
          title={`${meetingDateLabel(latest.date)} · ${meetingTimeLabel(latest.start, latest.end)}`}
          subtitle={t("tutorClass.attendance.entryUnmarked")}
        />
      ) : null}
      <ListRow
        href={attendanceHistoryHref(classId)}
        title={t("tutorClass.attendance.historyTitle")}
        subtitle={result.kind === "ok" && !latest ? t("tutorClass.attendance.entryUpToDate") : undefined}
      />
    </ListGroup>
  );
}
