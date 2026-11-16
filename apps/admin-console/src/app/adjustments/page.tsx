"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FilePenLine, Plus, XCircle } from "lucide-react";
import {
  AdminStatusChip,
  ColumnToggle,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  FilterBar,
  IdCell,
  IdentityCell,
  Notice,
  Page,
  PageHeader,
  Pagination,
  SegmentedControl,
  SelectField,
  Sheet,
  TextAreaField,
  TextField,
  useAdminSession,
  useColumnVisibility,
  type DataTableColumn,
} from "@/components/app";
import { Money } from "@/components/app/Money";
import { toast } from "@/components/app/toastStore";
import { useRefreshAdminSummary } from "@/components/app/adminSummaryContext";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api, newIdempotencyKey } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { currentBangkokMonth, formatPeriodMonth, formatSatang, shiftPeriodMonth } from "@/lib/format";
import { statusLabel, statusOptions } from "@/lib/status";
import { t } from "@/lib/i18n";
import { DateTimeParts, focusToolbar, LoadError } from "../settlements/financeUi";
import { TutorPicker, type PickedTutor } from "./TutorPicker";
import { parseBahtToSatang } from "./money";
import "@/locales/th/adjustments";

interface Adjustment {
  adjustmentId: string;
  tutorUserId: string;
  tutorName: string;
  periodMonth: string;
  settlementRunId: string;
  settlementRunStatus: string | null;
  amountSatang: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  approvedByUserId: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
}

interface AdjustmentPage {
  adjustments: Adjustment[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

interface DecisionResponse {
  settlementRefresh?: { refreshed?: boolean; status?: string | null; stale?: boolean };
}

/** Runs that no longer accept adjustments (backend: SETTLEMENT_IMMUTABLE). */
const LOCKED_RUN_STATUSES = ["SUBMITTED", "APPROVING", "APPROVED", "PAID", "REFRESHING"];

function periodChoices(): string[] {
  const current = currentBangkokMonth();
  return Array.from({ length: 13 }, (_, index) => shiftPeriodMonth(current, 1 - index));
}

/**
 * Maker / checker cell: the name wraps, and the date and the time are each
 * kept whole but may sit on two lines, so the table fits its card at 1280.
 * Same text as formatThaiDateTime(at, "short").
 */
function WhoWhen({ name, at }: { name: string | null; at: string }) {
  return (
    <span className="flex flex-col text-[0.8125rem] leading-snug">
      <span className="text-balance break-words">{name}</span>
      <span className="text-fg-muted tabular">
        <DateTimeParts at={at} style="short" />
      </span>
    </span>
  );
}

export default function AdjustmentsPage() {
  return (
    <Suspense>
      <AdjustmentsView />
    </Suspense>
  );
}

function AdjustmentsView() {
  const me = useAdminSession();
  const refreshSummary = useRefreshAdminSummary();
  const canCreate = me?.role === "ADMIN";
  const canCheck = me?.role === "ADMIN" || me?.role === "FINANCE_CHECKER";
  const table = useTableState({
    filterKeys: ["status", "period"],
    defaultFilters: { status: "PENDING" },
    defaultPageSize: 20,
  });
  const toolbarRef = useRef<HTMLDivElement>(null);

  const key = me ? `${me.userId}:adjustments:${table.queryKey}` : null;
  const { data, error, isLoading, isValidating, refetch } = useCachedResource(
    key,
    () =>
      api.get<AdjustmentPage>("/v1/adjustments", {
        query: {
          page: table.page,
          pageSize: table.pageSize,
          status: table.filters.status || undefined,
          periodMonth: table.filters.period || undefined,
        },
      }),
    { keepPreviousData: true },
  );

  const [decision, setDecision] = useState<{ row: Adjustment; kind: "approve" | "reject"; key: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const afterChange = async () => {
    if (me) {
      invalidateResource(`${me.userId}:adjustments:`);
      invalidateResource(`${me.userId}:settlements:`);
    }
    await refetch();
    void refreshSummary();
  };

  const periods = useMemo(() => periodChoices(), []);

  const columns: DataTableColumn<Adjustment>[] = [
    {
      key: "tutor",
      header: t("adjustments.colTutor"),
      label: t("adjustments.colTutor"),
      mobile: "primary",
      sticky: true,
      alwaysVisible: true,
      cell: (row) => <IdentityCell name={row.tutorName} seed={row.tutorUserId} secondary={<IdCell id={row.tutorUserId} />} />,
    },
    {
      key: "status",
      header: t("adjustments.colStatus"),
      label: t("adjustments.colStatus"),
      mobile: "secondary",
      cell: (row) => <AdminStatusChip domain="adjustment" status={row.status} />,
    },
    {
      key: "amount",
      header: t("adjustments.colAmount"),
      label: t("adjustments.colAmount"),
      align: "right",
      mobile: "trailing",
      cell: (row) => <Money satang={row.amountSatang} fractionDigits={2} signed className="font-semibold" />,
    },
    {
      key: "period",
      header: t("adjustments.colPeriod"),
      label: t("adjustments.colPeriod"),
      mobile: "field",
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <Link href={`/settlements/${row.settlementRunId}`} className="inline-flex items-center font-medium whitespace-nowrap text-brand-fg hover:underline pointer-coarse:min-h-11">
            {formatPeriodMonth(row.periodMonth)}
          </Link>
          {row.settlementRunStatus ? <AdminStatusChip domain="settlementRun" status={row.settlementRunStatus} /> : null}
        </span>
      ),
    },
    {
      key: "reason",
      header: t("adjustments.colReason"),
      label: t("adjustments.colReason"),
      mobile: "field",
      cell: (row) => (
        <span className="line-clamp-2 max-w-64 min-w-28 text-[0.8125rem] break-words" title={row.reason}>
          {row.reason}
        </span>
      ),
    },
    {
      key: "maker",
      header: t("adjustments.colMaker"),
      label: t("adjustments.colMaker"),
      mobile: "field",
      cell: (row) => <WhoWhen name={row.createdByName} at={row.createdAt} />,
    },
    {
      key: "checker",
      header: t("adjustments.colChecker"),
      label: t("adjustments.colChecker"),
      mobile: "field",
      cell: (row) =>
        row.approvedAt ? (
          <WhoWhen name={row.approvedByName} at={row.approvedAt} />
        ) : (
          <span className="text-fg-subtle">–</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("adjustments.colActions")}</span>,
      label: t("adjustments.colActions"),
      // Phones: a full-width row at the bottom of the card, not a half-width "จัดการ" field.
      mobile: "actions",
      alwaysVisible: true,
      cell: (row) => {
        if (row.status !== "PENDING" || !canCheck) return null;
        if (row.createdByUserId === me?.userId) {
          return <span className="text-[0.8125rem] text-fg-muted">{t("adjustments.selfBlockedShort")}</span>;
        }
        // Table: stacked below 1400px so the column claims no spare width (the maker/checker cells get it); side by
        // side above. Phone cards: side by side in the card's full-width actions row.
        return (
          <span className="flex flex-col items-start gap-1.5 max-md:flex-row max-md:flex-wrap min-[1400px]:flex-row min-[1400px]:flex-wrap">
            <Button size="sm" variant="tonal" onClick={() => setDecision({ row, kind: "approve", key: newIdempotencyKey() })}>
              <CheckCircle2 aria-hidden="true" />
              {t("adjustments.approve")}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDecision({ row, kind: "reject", key: newIdempotencyKey() })}>
              <XCircle aria-hidden="true" />
              {t("adjustments.rejectVoid")}
            </Button>
          </span>
        );
      },
    },
  ];

  const decisionRow = decision?.row;
  const decisionDetails = decisionRow ? (
    <DescriptionList
      columns={1}
      items={[
        { label: t("adjustments.colTutor"), value: decisionRow.tutorName },
        { label: t("adjustments.colAmount"), value: <Money satang={decisionRow.amountSatang} fractionDigits={2} signed className="text-base font-semibold" /> },
        {
          label: t("adjustments.colPeriod"),
          value: `${formatPeriodMonth(decisionRow.periodMonth)}${
            decisionRow.settlementRunStatus ? ` · ${statusLabel("settlementRun", decisionRow.settlementRunStatus)}` : ""
          }`,
        },
        { label: t("adjustments.colReason"), value: decisionRow.reason, wide: true },
        { label: t("adjustments.colMaker"), value: decisionRow.createdByName },
      ]}
    />
  ) : null;

  const visibility = useColumnVisibility("adjustments", columns);
  // The empty state's "ล้างตัวกรอง" removes itself: focus goes back to the toolbar.
  // (FilterBar's own button moves focus by itself.)
  const resetFilters = () => {
    table.reset();
    focusToolbar(toolbarRef.current);
  };

  // The period filter: inline from 768px, in the "ตัวกรอง" sheet on phones (patterns.md A2).
  const periodSelect = (props: { id: string; label?: string; containerClassName: string }) => (
    <SelectField
      id={props.id}
      aria-label={props.label ? undefined : t("adjustments.colPeriod")}
      label={props.label}
      containerClassName={props.containerClassName}
      value={table.filters.period ?? ""}
      onChange={(event) => table.setFilter("period", event.target.value)}
      options={[
        { value: "", label: t("adjustments.allPeriods") },
        ...periods.map((value) => ({ value, label: formatPeriodMonth(value) })),
      ]}
    />
  );

  return (
    <Page>
      <PageHeader
        title={t("adjustments.pageTitle")}
        description={t("adjustments.pageDescription")}
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              {t("adjustments.createButton")}
            </Button>
          ) : null
        }
      />

      <Notice tone="info">{t("adjustments.makerCheckerNote")}</Notice>

      <div ref={toolbarRef}>
        <FilterBar
          tabs={
            <SegmentedControl
              aria-label={t("adjustments.colStatus")}
              value={table.filters.status ?? ""}
              onValueChange={(next) => table.setFilter("status", next)}
              items={statusOptions("adjustment", { all: t("adjustments.allStatus") })}
            />
          }
          isFiltered={table.isFiltered}
          onReset={table.reset}
          actions={<ColumnToggle id="adjustments-columns" columns={columns} hidden={visibility.hidden} onToggle={visibility.toggle} />}
          moreFilters={{
            active: table.filters.period
              ? [
                  {
                    key: "period",
                    label: `${t("adjustments.colPeriod")}: ${formatPeriodMonth(table.filters.period)}`,
                    onRemove: () => table.setFilter("period", ""),
                  },
                ]
              : [],
            onReset: () => table.setFilter("period", ""),
            children: periodSelect({ id: "adjustments-period-sheet", label: t("adjustments.colPeriod"), containerClassName: "w-full" }),
          }}
        >
          {periodSelect({ id: "adjustments-period", containerClassName: "hidden md:flex md:w-48" })}
        </FilterBar>
      </div>

      {error && !data ? (
        <LoadError error={error} onRetry={() => void refetch()} />
      ) : (
        <DataTable
          caption={t("adjustments.tableCaption")}
          columns={columns}
          rows={data?.adjustments ?? []}
          getRowKey={(row) => row.adjustmentId}
          hiddenColumns={visibility.hidden}
          loading={isLoading || (isValidating && !data)}
          empty={
            <EmptyState
              icon={FilePenLine}
              title={t("adjustments.emptyTitle")}
              description={t("adjustments.emptyFiltered")}
              action={
                table.isFiltered ? (
                  <Button variant="outline" onClick={resetFilters}>
                    {t("shell.clearFilters")}
                  </Button>
                ) : undefined
              }
            />
          }
          footer={
            <Pagination
              page={table.page}
              pageSize={table.pageSize}
              total={data?.pagination.total ?? 0}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          }
        />
      )}

      <ConfirmDialog
        open={decision?.kind === "approve"}
        onOpenChange={(open) => !open && setDecision(null)}
        title={t("adjustments.confirmApproveTitle2")}
        description={t("adjustments.confirmApproveBody2")}
        confirmLabel={t("adjustments.approve")}
        details={decisionDetails}
        reason={{ label: t("adjustments.noteLabel"), placeholder: t("adjustments.notePlaceholder"), required: false }}
        onConfirm={async ({ reason }) => {
          if (!decision) return;
          const result = await api.post<DecisionResponse>(
            `/v1/adjustments/${decision.row.adjustmentId}/approve`,
            reason ? { reason } : undefined,
            { idempotencyKey: decision.key },
          );
          if (result.settlementRefresh?.stale) {
            toast.success(t("adjustments.approvedStale"), {
              description: t("adjustments.approvedStaleHint", { period: formatPeriodMonth(decision.row.periodMonth) }),
            });
          } else {
            toast.success(t("adjustments.approvedDone"));
          }
          await afterChange();
        }}
      >
        {decisionRow?.settlementRunStatus === "SUBMITTED" ? (
          <Notice tone="warning">{t("adjustments.approveOnSubmittedWarning")}</Notice>
        ) : decisionRow?.settlementRunStatus === "DRAFT" ? (
          <Notice tone="info">{t("adjustments.approveOnDraftNote")}</Notice>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={decision?.kind === "reject"}
        onOpenChange={(open) => !open && setDecision(null)}
        tone="danger"
        title={t("adjustments.confirmRejectTitle2")}
        description={t("adjustments.confirmRejectBody2")}
        confirmLabel={t("adjustments.rejectVoid")}
        details={decisionDetails}
        reason={{ label: t("adjustments.rejectReasonLabel"), placeholder: t("adjustments.rejectReasonPlaceholder") }}
        onConfirm={async ({ reason }) => {
          if (!decision) return;
          await api.post(`/v1/adjustments/${decision.row.adjustmentId}/reject`, { reason }, { idempotencyKey: decision.key });
          toast.success(t("adjustments.rejectedDone"));
          await afterChange();
        }}
      />

      {canCreate ? (
        <CreateAdjustmentSheet
          open={createOpen}
          onOpenChange={setCreateOpen}
          periods={periods}
          userId={me?.userId ?? ""}
          onCreated={afterChange}
        />
      ) : null}
    </Page>
  );
}

function CreateAdjustmentSheet({
  open,
  onOpenChange,
  periods,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periods: string[];
  userId: string;
  onCreated: () => Promise<void>;
}) {
  const [tutor, setTutor] = useState<PickedTutor | null>(null);
  const [period, setPeriod] = useState(() => shiftPeriodMonth(currentBangkokMonth(), -1));
  const [direction, setDirection] = useState<"add" | "deduct">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestKey, setRequestKey] = useState("");

  // What happens to the target month: locked runs refuse new adjustments.
  const runKey = open && userId ? `${userId}:settlements:period:${period}` : null;
  const runLookup = useCachedResource(
    runKey,
    () =>
      api.get<{ settlements: Array<{ snapshotId: string; status: string }> }>("/v1/settlements", {
        query: { periodMonth: period, pageSize: 1 },
      }),
    { staleTime: 0 },
  );
  const targetRun = runLookup.data?.settlements[0] ?? null;
  const locked = Boolean(targetRun && LOCKED_RUN_STATUSES.includes(targetRun.status));

  const satang = parseBahtToSatang(amount);
  const signedSatang = satang === null ? null : direction === "deduct" ? -satang : satang;
  const errors = {
    tutor: !tutor ? t("adjustments.errorTutor") : undefined,
    amount: satang === null ? t("adjustments.errorAmount") : undefined,
    reason: reason.trim().length < 5 ? t("adjustments.errorReason") : undefined,
  };
  const valid = !errors.tutor && !errors.amount && !errors.reason && !locked;

  const reset = () => {
    setTutor(null);
    setAmount("");
    setReason("");
    setDirection("add");
    setTouched(false);
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        onClosed={() => {
          if (!confirmOpen) reset();
        }}
        title={t("adjustments.createTitle")}
        description={t("adjustments.createDescription")}
        width={480}
        footer={
          // DOM order = visual order on every width (cancel, then the primary below it on phones / to its right on desktop).
          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
            <Button variant="outline" size="lg" className="md:h-9" onClick={() => onOpenChange(false)}>
              {t("adjustments.cancel")}
            </Button>
            <Button
              size="lg"
              className="md:h-9"
              onClick={() => {
                setTouched(true);
                if (!valid) {
                  // Move focus to the first invalid field so its error (aria-describedby) is read.
                  requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
                  return;
                }
                setRequestKey(newIdempotencyKey());
                setConfirmOpen(true);
              }}
            >
              {t("adjustments.reviewAndCreate")}
            </Button>
          </div>
        }
      >
        {/* Two-column field grid from 768px (A4): period and direction share a row; everything else spans both. */}
        <div ref={formRef} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0 md:col-span-2">
            <TutorPicker value={tutor} onChange={setTutor} error={touched ? errors.tutor : undefined} />
          </div>
          {tutor && tutor.verificationStatus && tutor.verificationStatus !== "VERIFIED" ? (
            <Notice tone="warning" className="md:col-span-2">
              {t("adjustments.unverifiedTutorWarning")}
            </Notice>
          ) : null}
          <SelectField
            label={t("adjustments.fieldPeriod")}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            options={periods.map((value) => ({ value, label: formatPeriodMonth(value) }))}
            required
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[0.8125rem] leading-normal font-medium text-fg">{t("adjustments.fieldDirection")}</span>
            <SegmentedControl
              aria-label={t("adjustments.fieldDirection")}
              value={direction}
              onValueChange={setDirection}
              fullWidth
              items={[
                { value: "add", label: t("adjustments.directionAdd") },
                { value: "deduct", label: t("adjustments.directionDeduct") },
              ]}
            />
          </div>
          {locked ? (
            <Notice tone="danger" className="md:col-span-2">
              {t("adjustments.periodLocked", { status: statusLabel("settlementRun", targetRun!.status) })}
            </Notice>
          ) : targetRun ? (
            <Notice tone="info" className="md:col-span-2">
              {t("adjustments.periodHasRun", { status: statusLabel("settlementRun", targetRun.status) })}
            </Notice>
          ) : runLookup.data ? (
            <Notice tone="info" className="md:col-span-2">
              {t("adjustments.periodNoRun")}
            </Notice>
          ) : null}
          <TextField
            label={t("adjustments.fieldAmount")}
            containerClassName="md:col-span-2"
            inputMode="decimal"
            autoComplete="off"
            placeholder="1,500.00"
            startAddon="฿"
            numeric
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
            hint={
              signedSatang !== null
                ? t("adjustments.amountPreview", { amount: formatSatang(signedSatang, { signed: true }) })
                : t("adjustments.amountHint")
            }
            error={touched ? errors.amount : undefined}
          />
          {direction === "deduct" ? (
            <Notice tone="warning" className="md:col-span-2">
              {t("adjustments.deductNote")}
            </Notice>
          ) : null}
          <TextAreaField
            containerClassName="md:col-span-2"
            label={t("adjustments.fieldReason")}
            placeholder={t("adjustments.reasonPlaceholder")}
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            error={touched ? errors.reason : undefined}
          />
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("adjustments.confirmCreateTitle")}
        description={t("adjustments.confirmCreateBody")}
        confirmLabel={t("adjustments.submit")}
        details={
          tutor && signedSatang !== null ? (
            <DescriptionList
              columns={1}
              items={[
                { label: t("adjustments.colTutor"), value: tutor.name ?? tutor.email ?? tutor.id },
                { label: t("adjustments.colPeriod"), value: formatPeriodMonth(period) },
                { label: t("adjustments.colAmount"), value: <Money satang={signedSatang} fractionDigits={2} signed className="text-base font-semibold" /> },
                { label: t("adjustments.colReason"), value: reason.trim(), wide: true },
              ]}
            />
          ) : null
        }
        onConfirm={async () => {
          if (!tutor || signedSatang === null) return;
          await api.post(
            "/v1/adjustments",
            { tutorUserId: tutor.id, periodMonth: period, amountSatang: signedSatang, reason: reason.trim() },
            { idempotencyKey: requestKey },
          );
          toast.success(t("adjustments.submitSuccess"));
          onOpenChange(false);
          reset();
          await onCreated();
        }}
      />
    </>
  );
}
