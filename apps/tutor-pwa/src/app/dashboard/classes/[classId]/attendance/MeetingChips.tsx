import { Chip } from "@/components/app";
import { t } from "@/lib/i18n";
import type { MeetingSource } from "./attendanceModel";

/** How a meeting relates to the current schedule. Renders nothing for an ordinary scheduled meeting. */
export function MeetingChips({
  meeting,
}: {
  meeting: { source: MeetingSource; inSchedule: boolean; movedFrom: string | null };
}) {
  return (
    <>
      {meeting.source === "ADHOC" ? (
        <Chip tone="info" size="sm">
          {t("tutorClass.attendance.adhocChip")}
        </Chip>
      ) : null}
      {meeting.movedFrom ? (
        <Chip tone="neutral" size="sm">
          {`${t("tutorClass.attendance.movedFromPrefix")} ${meeting.movedFrom}`}
        </Chip>
      ) : null}
      {meeting.source === "SCHEDULED" && !meeting.inSchedule ? (
        <Chip tone="neutral" size="sm">
          {t("tutorClass.attendance.offScheduleChip")}
        </Chip>
      ) : null}
    </>
  );
}
