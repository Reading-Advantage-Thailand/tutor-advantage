"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck, CircleDashed, Clock3, Users, X, type LucideIcon } from "lucide-react";
import {
  Chip,
  ConfirmDialog,
  EmptyState,
  Notice,
  PageHeader,
  StatStrip,
  StickyActions,
  UserAvatar,
  toast,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { reloadAttendanceMeeting, saveAttendanceMeeting } from "../actions";
import {
  attendanceErrorMessage,
  buildSaveBody,
  countsLabel,
  effectiveStatus,
  hasMeetingChips,
  hasUnmarkedStudents,
  markAllPresent,
  meetingBlockReason,
  meetingDateLabel,
  meetingTimeLabel,
  pruneChanges,
  statusLabel,
  statusTone,
  summarizeRoster,
  toggleMark,
  type AttendanceMeetingData,
  type AttendanceStatus,
  type MarkChanges,
  type RosterRow,
} from "../attendanceModel";
import { DateTile } from "../DateTile";
import { MeetingChips } from "../MeetingChips";
import { StatusControl } from "./StatusControl";
import { useUnsavedGuard } from "./useUnsavedGuard";

function StudentRow({
  row,
  status,
  readOnly,
  onSelect,
}: {
  row: RosterRow;
  status: AttendanceStatus | null;
  readOnly: boolean;
  onSelect: (status: AttendanceStatus) => void;
}) {
  const name = row.name || t("tutorClass.students.unnamed");
  const hint = row.joinedAt
    ? `${t("tutorClass.attendance.joinedPrefix")} ${formatThaiTime(row.joinedAt)}`
    : row.joinedLater
      ? t("tutorClass.attendance.joinedLaterNote")
      : undefined;
  const subtitle = row.enrolled ? hint : t("tutorClass.attendance.notEnrolledNote");
  return (
    <li
      className={cn(
        "flex min-w-0 gap-3 px-4 py-3 md:items-center md:gap-4 md:px-5",
        row.enrolled ? "flex-col md:flex-row" : "items-center",
      )}
    >
      <div className={cn("flex min-w-0 flex-1 items-center gap-3", !row.enrolled && "opacity-70")}>
        <UserAvatar name={row.name} src={row.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-base leading-normal font-semibold text-fg">{name}</p>
          {subtitle ? <p className="line-clamp-2 text-sm leading-[1.6] text-fg-muted">{subtitle}</p> : null}
        </div>
      </div>
      {row.enrolled ? (
        <StatusControl name={name} value={status} disabled={readOnly} onSelect={onSelect} />
      ) : status ? (
        <Chip tone={statusTone(status)} size="sm" dot>
          {statusLabel(status)}
        </Chip>
      ) : null}
    </li>
  );
}

/** Totals label with the same icon the status control uses (status = colour + icon + word). */
function TotalLabel({ icon: Icon, className, children }: { icon: LucideIcon; className?: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden="true" className={cn("size-4 shrink-0", className)} />
      {children}
    </span>
  );
}

export function MeetingForm({
  classId,
  initial,
  initialEnd,
  header,
}: {
  classId: string;
  initial: AttendanceMeetingData;
  /** End time typed in the make-up form; the meeting has none until it is saved. */
  initialEnd: string | null;
  header: { title: string; backHref: string; backLabel: string };
}) {
  const router = useRouter();
  const [{ meeting, roster }, setData] = useState(initial);
  const [fallbackEnd, setFallbackEnd] = useState(initialEnd);
  const [changes, setChanges] = useState<MarkChanges>({});
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  const dirty = Object.keys(changes).length > 0;
  const { pendingHref, clearPending, askingBack, cancelBack, confirmBack } = useUnsavedGuard(dirty);
  const blockReason = meetingBlockReason(meeting, new Date());
  const hasEditableRows = roster.some((row) => row.enrolled);
  const canMark = hasEditableRows && !blockReason;

  const edit = (next: MarkChanges) => {
    setChanges(next);
    setErrorText("");
  };

  const reload = async () => {
    const fresh = await reloadAttendanceMeeting(classId, meeting.date, meeting.start).catch(() => null);
    if (!fresh?.ok) return;
    setData(fresh.data);
    setChanges((current) => pruneChanges(fresh.data.roster, current));
  };

  const handleSave = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setErrorText("");
    try {
      const result = await saveAttendanceMeeting(classId, buildSaveBody(meeting, changes, fallbackEnd));
      if (result.ok) {
        setData(result.data);
        setChanges({});
        // Removing the last mark deletes the row and its end, so keep the end for a re-mark on this page.
        if (result.data.meeting.end) setFallbackEnd(result.data.meeting.end);
        toast.success(t("tutorClass.attendance.saved"));
      } else {
        setErrorText(attendanceErrorMessage(result.code));
        if (result.code === "STUDENT_NOT_ENROLLED") await reload();
      }
    } catch {
      setErrorText(attendanceErrorMessage(null));
    }
    setSaving(false);
  };

  const totals = summarizeRoster(roster, changes);

  return (
    <>
      {/* Phones: the title lives in the app bar, so the empty header gives its gap back. */}
      <PageHeader {...header} className="max-md:-mb-5" />

      {/* Why the page is read-only comes first (patterns.md §0), before the session card. */}
      {blockReason ? (
        <Notice tone="info">
          {blockReason === "notStarted" ? t("tutorClass.attendance.errorNotStarted") : t("tutorClass.attendance.adhocDateTooOld")}
        </Notice>
      ) : null}

      {/* Session card (patterns.md T5): the meeting's date and time, its chips, then the live totals. */}
      <section aria-label={meetingDateLabel(meeting.date)} className="ds-card min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 md:px-5 md:py-4">
          <DateTile date={meeting.date} className="size-12" />
          <div className="min-w-0 flex-1">
            <p className="text-base leading-normal font-semibold text-fg">{meetingDateLabel(meeting.date)}</p>
            <p className="text-sm leading-[1.55] text-fg-muted tabular">
              {meetingTimeLabel(meeting.start, meeting.end ?? fallbackEnd)}
            </p>
          </div>
          {hasMeetingChips(meeting) ? (
            <div className="flex flex-wrap items-center gap-1.5 max-sm:basis-full max-sm:pl-[60px]">
              <MeetingChips meeting={meeting} />
            </div>
          ) : null}
        </div>
        {roster.length > 0 ? (
          <StatStrip
            aria-label={t("tutorClass.detailView.totalsLabel")}
            className="rounded-none border-0 border-t border-hairline shadow-none"
            items={[
              {
                label: <TotalLabel icon={Check} className="text-success-fg">{t("tutorClass.attendance.present")}</TotalLabel>,
                value: totals.present,
              },
              {
                label: <TotalLabel icon={Clock3} className="text-warning-fg">{t("tutorClass.attendance.late")}</TotalLabel>,
                value: totals.late,
              },
              {
                label: <TotalLabel icon={X} className="text-danger-fg">{t("tutorClass.attendance.absent")}</TotalLabel>,
                value: totals.absent,
              },
              {
                label: <TotalLabel icon={CircleDashed} className="text-fg-muted">{t("tutorClass.attendance.unmarked")}</TotalLabel>,
                value: totals.unmarked,
              },
            ]}
          />
        ) : null}
      </section>

      {roster.length === 0 ? (
        <EmptyState
          mascot
          icon={Users}
          title={t("tutorClass.attendance.emptyRosterTitle")}
          description={t("tutorClass.attendance.emptyRosterDescription")}
        />
      ) : (
        <section aria-labelledby="attendance-roster-title" className="ds-card min-w-0 overflow-hidden">
          <div className="flex min-h-11 items-center justify-between gap-3 px-4 pt-3 pb-2 md:px-5 md:pt-4">
            <h2 id="attendance-roster-title" className="type-section text-fg">
              {t("tutorClass.attendance.rosterTitle")}
            </h2>
            {canMark ? (
              <Button
                variant="ghost-brand"
                disabled={saving || !hasUnmarkedStudents(roster, changes)}
                onClick={() => edit(markAllPresent(roster, changes))}
              >
                <CheckCheck aria-hidden="true" className="size-4" />
                {t("tutorClass.attendance.markAllPresent")}
              </Button>
            ) : null}
          </div>
          {/* Column captions on wider screens (each row's group is named after the student). */}
          <div
            aria-hidden="true"
            className="hidden items-center justify-between gap-4 border-y border-hairline bg-surface-muted px-5 py-2 text-[0.8125rem] leading-[1.4] font-semibold text-fg-muted md:flex"
          >
            <span>{t("tutorClass.classes.studentsTitle")}</span>
            <span>{t("tutorClass.detailView.statusColumn")}</span>
          </div>
          <ul className="divide-y divide-hairline border-t border-hairline md:border-t-0">
            {roster.map((row) => (
              <StudentRow
                key={row.studentUserId}
                row={row}
                status={effectiveStatus(row, changes)}
                readOnly={saving || Boolean(blockReason)}
                onSelect={(status) => edit(toggleMark(roster, changes, row.studentUserId, status))}
              />
            ))}
          </ul>
        </section>
      )}

      {canMark ? (
        <StickyActions className="justify-between gap-3">
          {errorText ? (
            <p role="alert" className="min-w-0 text-[0.8125rem] font-medium text-danger-fg">
              {errorText}
            </p>
          ) : (
            <p className="min-w-0 text-[0.8125rem] leading-[1.45] text-fg-muted tabular">{countsLabel(totals)}</p>
          )}
          <Button size="lg" className="shrink-0" loading={saving} disabled={!dirty} onClick={handleSave}>
            {saving ? t("tutorClass.attendance.saving") : t("tutorClass.attendance.save")}
          </Button>
        </StickyActions>
      ) : null}

      <ConfirmDialog
        open={pendingHref !== null || askingBack}
        onOpenChange={(open) => {
          if (open) return;
          clearPending();
          cancelBack();
        }}
        title={t("tutorClass.attendance.leaveTitle")}
        description={t("tutorClass.attendance.leaveDescription")}
        confirmLabel={t("tutorClass.attendance.leaveConfirm")}
        cancelLabel={t("tutorClass.attendance.leaveCancel")}
        tone="danger"
        onConfirm={() => {
          if (pendingHref) {
            router.push(pendingHref);
            clearPending();
            cancelBack();
          } else {
            confirmBack(() => router.replace(header.backHref));
          }
        }}
      />
    </>
  );
}
