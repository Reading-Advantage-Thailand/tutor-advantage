"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import {
  BottomSheet,
  Chip,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  ListRowSkeleton,
  SectionHeader,
  Surface,
} from "@/components/mobile";
import { classifyClassLoadError } from "@/lib/classAccess";
import { t } from "@/lib/i18n";
import {
  ATTENDANCE_STATUS_DISPLAY,
  attendanceRatePercent,
  formatMeetingDate,
  formatMeetingTime,
  isAttendanceUnavailable,
  selectAttendancePreview,
} from "./attendanceModel";
import type { AttendanceRecord, MyClassAttendance } from "./types";

export interface AttendanceState {
  data: MyClassAttendance | undefined;
  error: unknown;
  isLoading: boolean;
  isValidating: boolean;
  refetch: () => void;
}

function AttendanceRows({ records }: { records: AttendanceRecord[] }) {
  return (
    <ListGroup>
      {records.map((record) => {
        const display = ATTENDANCE_STATUS_DISPLAY[record.status];
        return (
          <ListRow
            key={`${record.date}T${record.start}`}
            title={formatMeetingDate(record.date)}
            subtitle={formatMeetingTime(record.start, record.end)}
            trailing={
              <Chip tone={display.tone} dot>
                {t(display.labelKey)}
              </Chip>
            }
          />
        );
      })}
    </ListGroup>
  );
}

function SummaryChips({ summary }: { summary: MyClassAttendance["summary"] }) {
  const ratePercent = attendanceRatePercent(summary.rate);
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {ratePercent !== null ? (
        <Chip tone="brand" size="md">
          {`${t("classes.detail.attendance.ratePrefix")} ${ratePercent}%`}
        </Chip>
      ) : null}
      <Chip tone={ATTENDANCE_STATUS_DISPLAY.PRESENT.tone} size="md">
        {`${t("classes.detail.attendance.present")} ${summary.present}`}
      </Chip>
      <Chip tone={ATTENDANCE_STATUS_DISPLAY.LATE.tone} size="md">
        {`${t("classes.detail.attendance.late")} ${summary.late}`}
      </Chip>
      <Chip tone={ATTENDANCE_STATUS_DISPLAY.ABSENT.tone} size="md">
        {`${t("classes.detail.attendance.absent")} ${summary.absent}`}
      </Chip>
    </div>
  );
}

function AttendanceBody({ attendance }: { attendance: AttendanceState }) {
  const { data, error } = attendance;
  if (attendance.isLoading) {
    return (
      <ListGroup>
        <ListRowSkeleton count={2} leading={false} />
      </ListGroup>
    );
  }
  if (!data) {
    return (
      <Surface padding="none">
        <ErrorState
          title={t("classes.detail.attendance.loadFailed")}
          kind={classifyClassLoadError(error) === "offline" ? "offline" : "error"}
          onRetry={attendance.refetch}
          retrying={attendance.isValidating}
          mascot={false}
          className="py-6"
        />
      </Surface>
    );
  }
  if (data.records.length === 0) {
    return (
      <Surface padding="none">
        <EmptyState
          icon={ClipboardCheck}
          tone="neutral"
          mascot={false}
          title={t("classes.detail.attendance.emptyTitle")}
          description={t("classes.detail.attendance.emptyDescription")}
          className="py-6"
        />
      </Surface>
    );
  }
  return (
    <>
      <SummaryChips summary={data.summary} />
      <AttendanceRows records={selectAttendancePreview(data.records).preview} />
    </>
  );
}

/**
 * The enrolled student's own attendance in this class (read-only). A failed
 * load retries here and never affects the rest of the class page.
 */
export function AttendanceSection({ attendance }: { attendance: AttendanceState }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data, error } = attendance;

  if (!data && isAttendanceUnavailable(error)) return null;

  const hasMore = data ? selectAttendancePreview(data.records).hasMore : false;

  return (
    <section>
      <SectionHeader
        as="h3"
        title={t("classes.detail.attendance.title")}
        action={hasMore ? { label: t("classes.detail.attendance.seeAll"), onClick: () => setSheetOpen(true) } : undefined}
      />
      <div className="mt-1">
        <AttendanceBody attendance={attendance} />
      </div>
      {data && hasMore ? (
        <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title={t("classes.detail.attendance.allTitle")}>
          <AttendanceRows records={data.records} />
        </BottomSheet>
      ) : null}
    </section>
  );
}
