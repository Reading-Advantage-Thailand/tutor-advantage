"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, XCircle } from "lucide-react";
import {
  AdminStatusChip,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  ErrorState,
  FilterBar,
  IdCell,
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
  type DataTableColumn,
} from "@/components/app";
import { Money } from "@/components/app/Money";
import { toast } from "@/components/app/Toast";
import { useRefreshAdminSummary } from "@/components/app/AdminSummary";
import { Button } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api, newIdempotencyKey } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { currentBangkokMonth, formatPeriodMonth, formatSatang, formatThaiDateTime, shiftPeriodMonth } from "@/lib/format";
import { statusLabel, statusOptions } from "@/lib/status";
import { t } from "@/lib/i18n";
import { TutorPicker, type PickedTutor } from "./TutorPicker";
import { parseBahtToSatang } from "./money";

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
      alwaysVisible: true,
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">{row.tutorName}</span>
          <IdCell id={row.tutorUserId} />
        </span>
      ),
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
      cell: (row) => <Money satang={row.amountSatang} signed className="font-semibold" />,
    },
    {
      key: "period",
      header: t("adjustments.colPeriod"),
      label: t("adjustments.colPeriod"),
      mobile: "field",
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <Link href={`/settlements/${row.settlementRunId}`} className="text-brand-fg hover:underline">
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
      cell: (row) => <span className="line-clamp-3 max-w-72 text-[0.8125rem]">{row.reason}</span>,
    },
    {
      key: "maker",
      header: t("adjustments.colMaker"),
      label: t("adjustments.colMaker"),
      mobile: "field",
      cell: (row) => (
        <span className="flex flex-col text-[0.8125rem] leading-snug">
          <span>{row.createdByName}</span>
          <span className="text-fg-muted">{formatThaiDateTime(row.createdAt, "short")}</span>
        </span>
      ),
    },
    {
      key: "checker",
      header: t("adjustments.colChecker"),
      label: t("adjustments.colChecker"),
      mobile: "field",
      cell: (row) =>
        row.approvedAt ? (
          <span className="flex flex-col text-[0.8125rem] leading-snug">
            <span>{row.approvedByName}</span>
            <span className="text-fg-muted">{formatThaiDateTime(row.approvedAt, "short")}</span>
          </span>
        ) : (
          <span className="text-fg-subtle">–</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("adjustments.colActions")}</span>,
      label: t("adjustments.colActions"),
      mobile: "field",
      alwaysVisible: true,
      cell: (row) => {
        if (row.status !== "PENDING" || !canCheck) return null;
        if (row.createdByUserId === me?.userId) {
          return <span className="text-[0.8125rem] text-fg-muted">{t("adjustments.selfBlockedShort")}</span>;
        }
        return (
          <span className="flex flex-wrap gap-1.5">
            <Button size="sm" onClick={() => setDecision({ row, kind: "approve", key: newIdempotencyKey() })}>
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
        { label: t("adjustments.colAmount"), value: <Money satang={decisionRow.amountSatang} signed className="text-base font-semibold" /> },
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

      <FilterBar isFiltered={table.isFiltered} onReset={table.reset}>
        <SelectField
          aria-label={t("adjustments.colStatus")}
          containerClassName="w-full sm:w-44"
          value={table.filters.status ?? ""}
          onChange={(event) => table.setFilter("status", event.target.value)}
          options={statusOptions("adjustment", { all: t("adjustments.allStatus") })}
        />
        <SelectField
          aria-label={t("adjustments.colPeriod")}
          containerClassName="w-full sm:w-48"
          value={table.filters.period ?? ""}
          onChange={(event) => table.setFilter("period", event.target.value)}
          options={[
            { value: "", label: t("adjustments.allPeriods") },
            ...periods.map((value) => ({ value, label: formatPeriodMonth(value) })),
          ]}
        />
      </FilterBar>

      {error && !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <DataTable
          caption={t("adjustments.tableCaption")}
          columns={columns}
          rows={data?.adjustments ?? []}
          getRowKey={(row) => row.adjustmentId}
          loading={isLoading || (isValidating && !data)}
          empty={
            <div className="flex flex-col items-center gap-1 py-10 text-center">
              <p className="font-medium text-fg">{t("adjustments.emptyTitle")}</p>
              <p className="text-sm text-fg-muted">{t("adjustments.emptyFiltered")}</p>
            </div>
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
        footer={
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <Button variant="ghost" size="lg" className="md:h-9" onClick={() => onOpenChange(false)}>
              {t("adjustments.cancel")}
            </Button>
            <Button
              size="lg"
              className="md:h-9"
              onClick={() => {
                setTouched(true);
                if (!valid) return;
                setRequestKey(newIdempotencyKey());
                setConfirmOpen(true);
              }}
            >
              {t("adjustments.reviewAndCreate")}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <TutorPicker value={tutor} onChange={setTutor} error={touched ? errors.tutor : undefined} />
          {tutor && tutor.verificationStatus && tutor.verificationStatus !== "VERIFIED" ? (
            <Notice tone="warning">{t("adjustments.unverifiedTutorWarning")}</Notice>
          ) : null}
          <SelectField
            label={t("adjustments.fieldPeriod")}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            options={periods.map((value) => ({ value, label: formatPeriodMonth(value) }))}
            required
          />
          {locked ? (
            <Notice tone="danger">{t("adjustments.periodLocked", { status: statusLabel("settlementRun", targetRun!.status) })}</Notice>
          ) : targetRun ? (
            <Notice tone="info">{t("adjustments.periodHasRun", { status: statusLabel("settlementRun", targetRun.status) })}</Notice>
          ) : runLookup.data ? (
            <Notice tone="info">{t("adjustments.periodNoRun")}</Notice>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg">{t("adjustments.fieldDirection")}</span>
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
          <TextField
            label={t("adjustments.fieldAmount")}
            inputMode="decimal"
            autoComplete="off"
            placeholder="1,500.00"
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
          {direction === "deduct" ? <Notice tone="warning">{t("adjustments.deductNote")}</Notice> : null}
          <TextAreaField
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
                { label: t("adjustments.colAmount"), value: <Money satang={signedSatang} signed className="text-base font-semibold" /> },
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
