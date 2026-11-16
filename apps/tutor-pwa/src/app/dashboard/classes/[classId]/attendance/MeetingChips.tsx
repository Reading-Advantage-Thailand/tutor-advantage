import { CalendarPlus, CalendarX2, MoveRight } from "lucide-react";
import { Chip } from "@/components/app";
import { t } from "@/lib/i18n";
import type { MeetingSource } from "./attendanceModel";

/** How a meeting relates to the current schedule (icon + word). Renders nothing for an ordinary scheduled meeting. */
export function MeetingChips({
  meeting,
}: {
  meeting: { source: MeetingSource; inSchedule: boolean; movedFrom: string | null };
}) {
  return (
    <>
      {meeting.source === "ADHOC" ? (
        <Chip tone="info" size="sm" icon={CalendarPlus}>
          {t("tutorClass.attendance.adhocChip")}
        </Chip>
      ) : null}
      {meeting.movedFrom ? (
        <Chip tone="neutral" size="sm" icon={MoveRight}>
          {`${t("tutorClass.attendance.movedFromPrefix")} ${meeting.movedFrom}`}
        </Chip>
      ) : null}
      {meeting.source === "SCHEDULED" && !meeting.inSchedule ? (
        <Chip tone="neutral" size="sm" icon={CalendarX2}>
          {t("tutorClass.attendance.offScheduleChip")}
        </Chip>
      ) : null}
    </>
  );
}
