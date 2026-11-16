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
  StatStrip,
  type StatStripItem,
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

/** Totals as one stat strip (rate when something is marked · present · late · absent), tabular numbers. */
function SummaryStrip({ summary }: { summary: MyClassAttendance["summary"] }) {
  const ratePercent = attendanceRatePercent(summary.rate);
  const items: StatStripItem[] = [
    ...(ratePercent !== null ? [{ value: `${ratePercent}%`, label: t("classes.detail.attendance.ratePrefix") }] : []),
    { value: summary.present, label: t(ATTENDANCE_STATUS_DISPLAY.PRESENT.labelKey) },
    { value: summary.late, label: t(ATTENDANCE_STATUS_DISPLAY.LATE.labelKey) },
    { value: summary.absent, label: t(ATTENDANCE_STATUS_DISPLAY.ABSENT.labelKey) },
  ];
  return <StatStrip numbers="tabular" items={items} className="mb-3" />;
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
      <ErrorState
        card
        headingLevel="h4"
        title={t("classes.detail.attendance.loadFailed")}
        kind={classifyClassLoadError(error) === "offline" ? "offline" : "error"}
        onRetry={attendance.refetch}
        retrying={attendance.isValidating}
        mascot={false}
        className="py-6"
      />
    );
  }
  if (data.records.length === 0) {
    return (
      <EmptyState
        card
        headingLevel="h4"
        icon={ClipboardCheck}
        tone="neutral"
        mascot={false}
        title={t("classes.detail.attendance.emptyTitle")}
        description={t("classes.detail.attendance.emptyDescription")}
        className="py-6"
      />
    );
  }
  return (
    <>
      <SummaryStrip summary={data.summary} />
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
