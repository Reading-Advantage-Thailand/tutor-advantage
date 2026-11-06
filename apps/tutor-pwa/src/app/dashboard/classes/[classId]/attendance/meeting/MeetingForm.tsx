"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Users } from "lucide-react";
import {
  Chip,
  ConfirmDialog,
  EmptyState,
  ListGroup,
  ListRow,
  Notice,
  PageHeader,
  StickyActions,
  UserAvatar,
  toast,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
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
  return (
    <ListRow
      leading={<UserAvatar name={row.name} src={row.avatarUrl} size="sm" />}
      title={name}
      subtitle={row.enrolled ? hint : t("tutorClass.attendance.notEnrolledNote")}
      trailing={
        row.enrolled ? (
          <StatusControl name={name} value={status} disabled={readOnly} onSelect={onSelect} />
        ) : status ? (
          <Chip tone={statusTone(status)} size="sm">
            {statusLabel(status)}
          </Chip>
        ) : null
      }
    />
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

  return (
    <>
      <PageHeader
        {...header}
        description={`${meetingDateLabel(meeting.date)} · ${meetingTimeLabel(meeting.start, meeting.end ?? fallbackEnd)}`}
        meta={hasMeetingChips(meeting) ? <MeetingChips meeting={meeting} /> : undefined}
      />

      {blockReason ? (
        <Notice tone="info">
          {blockReason === "notStarted" ? t("tutorClass.attendance.errorNotStarted") : t("tutorClass.attendance.adhocDateTooOld")}
        </Notice>
      ) : null}

      {roster.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("tutorClass.attendance.emptyRosterTitle")}
          description={t("tutorClass.attendance.emptyRosterDescription")}
        />
      ) : (
        <ListGroup
          header={t("tutorClass.attendance.rosterTitle")}
          headerAction={
            canMark ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={saving || !hasUnmarkedStudents(roster, changes)}
                onClick={() => edit(markAllPresent(roster, changes))}
              >
                <CheckCheck aria-hidden="true" className="size-4" />
                {t("tutorClass.attendance.markAllPresent")}
              </Button>
            ) : undefined
          }
        >
          {roster.map((row) => (
            <StudentRow
              key={row.studentUserId}
              row={row}
              status={effectiveStatus(row, changes)}
              readOnly={saving || Boolean(blockReason)}
              onSelect={(status) => edit(toggleMark(roster, changes, row.studentUserId, status))}
            />
          ))}
        </ListGroup>
      )}

      {canMark ? (
        <StickyActions className="justify-between gap-3">
          {errorText ? (
            <p role="alert" className="min-w-0 text-[0.8125rem] font-medium text-danger-fg">
              {errorText}
            </p>
          ) : (
            <p className="min-w-0 text-xs text-fg-muted">{countsLabel(summarizeRoster(roster, changes))}</p>
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
