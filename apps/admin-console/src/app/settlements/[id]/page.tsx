"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, Hourglass, ReceiptText, RefreshCw, Send, ShieldCheck, Undo2, Users, Wallet } from "lucide-react";
import {
  AdminStatusChip,
  Card,
  Chip,
  ConfirmDialog,
  DescriptionList,
  EmptyState,
  ErrorState,
  Grid,
  ListGroup,
  ListRow,
  Notice,
  Page,
  PageHeader,
  PageSkeleton,
  Section,
  StatCard,
  useAdminSession,
} from "@/components/app";
import { Money } from "@/components/app/Money";
import { toast } from "@/components/app/Toast";
import { useRefreshAdminSummary } from "@/components/app/AdminSummary";
import { Button } from "@/components/ui/button";
import { usePolling } from "@/hooks/usePolling";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatPeriodMonth, formatSatang, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { PayoutLinesTable } from "./PayoutLinesTable";
import { bankLabel, satangNumber, type PayoutLineRow, type SettlementDetailResponse, type TimelineEntry } from "../types";

type RunAction = "submit" | "approve" | "devApprove" | "reject" | "refresh";

const TIMELINE_LABEL: Record<string, string> = {
  CREATE: t("settlements.timelineCreate"),
  PREVIEW: t("settlements.timelinePreview"),
  REFRESH: t("settlements.timelineRefresh"),
  SUBMIT: t("settlements.timelineSubmit"),
  APPROVE: t("settlements.timelineApprove"),
  REJECT: t("settlements.timelineReject"),
};

const STALE_REASON_LABEL: Record<string, string> = {
  NOT_PREVIEWED: t("settlements.staleNotPreviewed"),
  LINES_CHANGED: t("settlements.staleLinesChanged"),
  ADJUSTMENTS_CHANGED: t("settlements.staleAdjustmentsChanged"),
};

export default function SettlementRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useAdminSession();
  const refreshSummary = useRefreshAdminSummary();
  const isAdmin = me?.role === "ADMIN";
  const isChecker = me?.role === "FINANCE_CHECKER";

  const key = me ? `${me.userId}:settlements:run:${id}` : null;
  const { data, error, isLoading, isValidating, refetch } = useCachedResource(key, () =>
    api.get<SettlementDetailResponse>(`/v1/settlements/${id}/lines`),
  );

  // One poller for the whole page, only while some Omise transfer is still moving.
  usePolling(() => refetch(), {
    interval: 8000,
    enabled: (data?.run.pendingTransferCount ?? 0) > 0,
    immediate: false,
  });

  const [action, setAction] = useState<RunAction | null>(null);
  const [actionKey, setActionKey] = useState<string>("");
  const [transferLine, setTransferLine] = useState<PayoutLineRow | null>(null);
  const [syncLine, setSyncLine] = useState<PayoutLineRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const openAction = (next: RunAction) => {
    setActionKey(newIdempotencyKey());
    setAction(next);
  };

  const afterMutation = async () => {
    if (me) invalidateResource(`${me.userId}:settlements:`);
    await refetch();
    void refreshSummary();
  };

  const run = data?.run;
  const freshness = run?.freshness ?? null;
  const isStale = Boolean(freshness?.stale);
  const isEmpty = (run?.payoutLineCount ?? 0) === 0;
  const pendingAdjustments = run?.pendingAdjustmentCount ?? 0;
  const plan = run?.transferPlan;
  const periodLabel = run ? formatPeriodMonth(run.periodMonth) : "";
  const adjustmentsHref = run ? `/adjustments?status=PENDING&period=${run.periodMonth}` : "/adjustments";

  const approveBlockedReason = useMemo(() => {
    if (!run) return null;
    if (isEmpty) return t("settlements.blockedEmpty");
    if (pendingAdjustments > 0) return t("settlements.blockedPendingAdjustments", { count: formatNumber(pendingAdjustments) });
    if (isStale) return t("settlements.blockedStale");
    if ((plan?.missingRecipientCount ?? 0) > 0) return t("settlements.blockedMissingRecipient", { count: formatNumber(plan!.missingRecipientCount) });
    return null;
  }, [run, isEmpty, pendingAdjustments, isStale, plan]);

  if (error && !data) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <Page width="medium">
          <PageHeader title={t("settlements.notFoundTitle")} backHref="/settlements" backLabel={t("settlements.backToList")} />
          <EmptyState
            icon={ReceiptText}
            title={t("settlements.notFoundTitle")}
            description={t("settlements.notFoundDescription")}
            action={
              <Button asChild variant="outline">
                <Link href="/settlements">{t("settlements.backToList")}</Link>
              </Button>
            }
          />
        </Page>
      );
    }
    return (
      <Page>
        <PageHeader title={t("settlements.detailTitleFallback")} backHref="/settlements" backLabel={t("settlements.backToList")} />
        <ErrorState onRetry={() => void refetch()} />
      </Page>
    );
  }
  if (isLoading || !data || !run || !plan) return <PageSkeleton variant="table" />;

  const status = run.status;
  const canRefresh =
    isAdmin && (["DRAFT", "REJECTED", "ADJUSTMENT_PENDING"].includes(status) || (status === "SUBMITTED" && isStale));
  const canSubmit = isAdmin && status === "DRAFT";
  const canCancelDraft = isAdmin && status === "DRAFT";
  const canApprove = isChecker && status === "SUBMITTED";
  const canReject = isChecker && status === "SUBMITTED";
  const canDevApprove = isAdmin && data.devMakerCheckerOverride && ["DRAFT", "SUBMITTED"].includes(status);
  const submitBlocked = isEmpty ? t("settlements.blockedEmpty") : isStale ? t("settlements.blockedStaleSubmit") : null;

  const runFacts = (
    <DescriptionList
      columns={2}
      items={[
        { label: t("settlements.factPeriod"), value: periodLabel },
        { label: t("settlements.factLines"), value: t("settlements.peopleCount", { count: formatNumber(run.payoutLineCount) }) },
        { label: t("settlements.factNet"), value: <Money satang={run.totalNetPayoutSatang} className="font-semibold text-fg" /> },
        { label: t("settlements.factWht"), value: <Money satang={run.totalWithholdingSatang} /> },
      ]}
    />
  );

  const transferStatement = plan.automatic ? (
    plan.count > 0 ? (
      <Notice tone="danger" title={t("settlements.transferWillSendTitle")}>
        {t("settlements.transferWillSendBody", {
          count: formatNumber(plan.count),
          amount: formatMoney(plan.totalNetSatang),
        })}
      </Notice>
    ) : (
      <Notice tone="info">{t("settlements.transferNoneBody")}</Notice>
    )
  ) : (
    <Notice tone="info">{t("settlements.transferManualBody", { count: formatNumber(plan.count) })}</Notice>
  );

  const executeRunAction = async (current: RunAction, reason: string) => {
    const path = current === "devApprove" ? "approve" : current;
    const body = current === "reject" ? { reason } : undefined;
    try {
      await api.post(`/v1/settlements/${id}/${path}`, body, { idempotencyKey: actionKey });
    } catch (err) {
      // A stale/blocked answer changes what the page should show: reload it under the dialog.
      if (err instanceof ApiError && err.status === 409) void refetch();
      throw err;
    }
    const message: Record<RunAction, string> = {
      submit: t("settlements.submitSuccess"),
      approve: t("settlements.approveDone"),
      devApprove: t("settlements.approveDone"),
      reject: isAdmin ? t("settlements.cancelDone") : t("settlements.rejectDone"),
      refresh: t("settlements.refreshDone"),
    };
    toast.success(message[current]);
    await afterMutation();
  };

  return (
    <Page>
      <PageHeader
        title={t("settlements.detailTitle", { period: periodLabel })}
        backHref="/settlements"
        backLabel={t("settlements.backToList")}
        meta={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <AdminStatusChip domain="settlementRun" status={status} size="md" />
            {isStale ? <Chip tone="danger">{t("settlements.chipStale")}</Chip> : null}
            {isEmpty && ["DRAFT", "ADJUSTMENT_PENDING"].includes(status) ? (
              <Chip tone="warning">{t("settlements.chipEmpty")}</Chip>
            ) : null}
          </span>
        }
        actions={
          <>
            {canRefresh ? (
              <Button variant={status === "DRAFT" && !isStale && !isEmpty ? "outline" : "default"} onClick={() => openAction("refresh")}>
                <RefreshCw aria-hidden="true" />
                {t("settlements.recalculate")}
              </Button>
            ) : null}
            {canCancelDraft ? (
              <Button variant="destructive" onClick={() => openAction("reject")}>
                <Undo2 aria-hidden="true" />
                {t("settlements.cancelDraft")}
              </Button>
            ) : null}
            {canSubmit ? (
              <Button disabled={Boolean(submitBlocked)} onClick={() => openAction("submit")}>
                <Send aria-hidden="true" />
                {t("settlements.submitForReview")}
              </Button>
            ) : null}
            {canReject ? (
              <Button variant="destructive" onClick={() => openAction("reject")}>
                <Undo2 aria-hidden="true" />
                {t("settlements.rejectRun")}
              </Button>
            ) : null}
            {canApprove ? (
              <Button disabled={Boolean(approveBlockedReason)} onClick={() => openAction("approve")}>
                <ShieldCheck aria-hidden="true" />
                {plan.automatic && plan.count > 0 ? t("settlements.approveAndTransfer") : t("settlements.approveRun")}
              </Button>
            ) : null}
            {canDevApprove ? (
              <Button variant="danger" disabled={Boolean(approveBlockedReason)} onClick={() => openAction("devApprove")}>
                <ShieldCheck aria-hidden="true" />
                {t("settlements.devApprove")}
              </Button>
            ) : null}
          </>
        }
      />

      {/* What blocks the next step, and how to get past it */}
      {isStale && freshness ? (
        <Notice tone="danger" title={t("settlements.staleTitle")} role="alert">
          <span className="flex flex-col gap-1.5">
            <span>{freshness.reasons.map((reason) => STALE_REASON_LABEL[reason] ?? reason).join(" · ")}</span>
            {freshness.changedTutors.length > 0 ? (
              <span>
                {t("settlements.staleTutors", {
                  names: freshness.changedTutors.map((tutor) => tutor.name ?? tutor.userId.slice(0, 8)).join(", "),
                })}
              </span>
            ) : null}
            <span className="font-medium">
              {isAdmin
                ? status === "SUBMITTED"
                  ? t("settlements.staleFixAdminSubmitted")
                  : t("settlements.staleFixAdminDraft")
                : t("settlements.staleFixChecker")}
            </span>
          </span>
        </Notice>
      ) : null}
      {status === "ADJUSTMENT_PENDING" ? (
        <Notice tone="info" title={t("settlements.holderTitle")}>
          {t("settlements.holderBody")}
        </Notice>
      ) : isEmpty && status === "DRAFT" ? (
        <Notice tone="warning" title={t("settlements.emptyRunTitle")}>
          {isAdmin ? t("settlements.emptyRunBodyAdmin") : t("settlements.emptyRunBodyChecker")}
        </Notice>
      ) : null}
      {pendingAdjustments > 0 && ["DRAFT", "SUBMITTED", "ADJUSTMENT_PENDING", "REJECTED"].includes(status) ? (
        <Notice tone="warning" title={t("settlements.pendingAdjustmentsTitle", { count: formatNumber(pendingAdjustments) })} href={adjustmentsHref}>
          {t("settlements.pendingAdjustmentsBody")}
        </Notice>
      ) : null}
      {/* Stale / empty / pending-adjustment blocks already have their own notice above. */}
      {(canApprove || canDevApprove) && plan.missingRecipientCount > 0 && !isStale && !isEmpty && pendingAdjustments === 0 ? (
        <Notice tone="warning">{approveBlockedReason}</Notice>
      ) : null}
      {canDevApprove ? (
        <Notice tone="warning" title={t("settlements.devOverrideTitle")}>
          {t("settlements.devOverrideBody")}
        </Notice>
      ) : null}

      <Grid cols={4} className="grid-cols-2">
        <StatCard label={t("settlements.statNet")} value={<Money satang={run.totalNetPayoutSatang} />} icon={Wallet} tone="brand" />
        <StatCard label={t("settlements.statGross")} value={<Money satang={run.totalPayoutSatang} />} icon={ReceiptText} tone="blue" />
        <StatCard label={t("settlements.statWht")} value={<Money satang={run.totalWithholdingSatang} />} icon={Hourglass} tone="neutral" />
        <StatCard
          label={t("settlements.statLines")}
          value={formatNumber(run.payoutLineCount)}
          icon={Users}
          tone="teal"
          hint={
            ["DRAFT", "SUBMITTED"].includes(status)
              ? t("settlements.statTransferHint", { count: formatNumber(plan.count) })
              : undefined
          }
        />
      </Grid>

      <Section
        title={t("settlements.linesTitle")}
        description={run.pendingTransferCount > 0 ? t("settlements.linesPolling") : undefined}
        className="min-w-0"
        action={
          <span className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void refetch()} loading={isValidating}>
              <RefreshCw aria-hidden="true" />
              {t("settlements.reload")}
            </Button>
            {!isEmpty ? (
              <Button
                variant="outline"
                size="sm"
                loading={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await api.download(`/v1/settlements/${id}/export`, `settlement-${run.periodMonth}.csv`);
                    toast.success(t("settlements.exportSuccess"));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : t("settlements.errorTitle"));
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Download aria-hidden="true" />
                {t("settlements.exportCsv")}
              </Button>
            ) : null}
          </span>
        }
      >
        <PayoutLinesTable
          lines={data.lines}
          runStatus={status}
          canSendTransfer={isChecker}
          loading={isValidating && data.lines.length === 0}
          onSendTransfer={(line) => {
            setActionKey(newIdempotencyKey());
            setTransferLine(line);
          }}
          onSyncTransfer={(line) => setSyncLine(line)}
        />
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title={t("settlements.timelineTitle")} className="min-w-0">
          <Timeline entries={run.timeline} />
        </Section>
        <Section title={t("settlements.summaryTitle")} className="min-w-0">
          <Card>
            <DescriptionList
              columns={1}
              items={[
                { label: t("settlements.factPayments"), value: run.paymentCount === null ? "–" : formatNumber(run.paymentCount) },
                { label: t("settlements.factApprovedAdjustments"), value: formatNumber(run.approvedAdjustmentCount) },
                ...(["DRAFT", "SUBMITTED"].includes(status) ? [{
                  label: t("settlements.factTransferPlan"),
                  value: t("settlements.transferPlanValue", {
                    count: formatNumber(plan.count),
                    amount: formatMoney(plan.totalNetSatang),
                  }),
                }] : []),
                ...(["DRAFT", "SUBMITTED"].includes(status) && plan.missingRecipientCount > 0
                  ? [
                      {
                        label: t("settlements.factMissingRecipient"),
                        value: t("settlements.transferPlanValue", {
                          count: formatNumber(plan.missingRecipientCount),
                          amount: formatMoney(plan.missingRecipientTotalSatang),
                        }),
                      },
                    ]
                  : []),
                {
                  label: t("settlements.factChecked"),
                  value: freshness ? formatThaiDateTime(freshness.checkedAt, "short") : "–",
                },
              ]}
            />
          </Card>
        </Section>
      </div>

      {/* ── Run-level confirmations ── */}
      <ConfirmDialog
        open={action === "submit"}
        onOpenChange={(open) => !open && setAction(null)}
        title={t("settlements.confirmSubmitTitle")}
        description={t("settlements.confirmSubmitBody")}
        confirmLabel={t("settlements.submitForReview")}
        details={runFacts}
        onConfirm={() => executeRunAction("submit", "")}
      />
      <ConfirmDialog
        open={action === "refresh"}
        onOpenChange={(open) => !open && setAction(null)}
        title={t("settlements.confirmRefreshTitle", { period: periodLabel })}
        description={status === "SUBMITTED" ? t("settlements.confirmRefreshSubmitted") : t("settlements.confirmRefreshBody")}
        confirmLabel={t("settlements.recalculate")}
        onConfirm={() => executeRunAction("refresh", "")}
      />
      <ConfirmDialog
        open={action === "reject"}
        onOpenChange={(open) => !open && setAction(null)}
        tone="danger"
        title={isAdmin ? t("settlements.confirmCancelTitle") : t("settlements.confirmRejectRunTitle")}
        description={isAdmin ? t("settlements.confirmCancelBody") : t("settlements.confirmRejectRunBody")}
        confirmLabel={isAdmin ? t("settlements.cancelDraft") : t("settlements.rejectRun")}
        details={runFacts}
        reason={{ label: t("settlements.reasonLabel"), placeholder: t("settlements.reasonPlaceholder") }}
        onConfirm={({ reason }) => executeRunAction("reject", reason)}
      />
      {(["approve", "devApprove"] as const).map((kind) => (
        <ConfirmDialog
          key={kind}
          open={action === kind}
          onOpenChange={(open) => !open && setAction(null)}
          tone="danger"
          irreversible
          title={
            kind === "devApprove"
              ? t("settlements.confirmDevApproveTitle", { period: periodLabel })
              : t("settlements.confirmApproveRunTitle", { period: periodLabel })
          }
          description={
            kind === "devApprove" ? t("settlements.confirmDevApproveBody") : t("settlements.confirmApproveRunBody")
          }
          confirmLabel={plan.automatic && plan.count > 0 ? t("settlements.approveAndTransfer") : t("settlements.approveRun")}
          details={runFacts}
          requireText={run.periodMonth}
          onConfirm={() => executeRunAction(kind, "")}
        >
          {transferStatement}
        </ConfirmDialog>
      ))}

      {/* ── Line-level confirmations (money moves) ── */}
      <ConfirmDialog
        open={Boolean(transferLine)}
        onOpenChange={(open) => !open && setTransferLine(null)}
        tone="danger"
        irreversible
        title={t("settlements.confirmTransferTitle")}
        description={t("settlements.confirmTransferBody")}
        confirmLabel={t("settlements.sendTransfer")}
        requireText={t("settlements.transferRequireText")}
        details={
          transferLine ? (
            <DescriptionList
              columns={1}
              items={[
                { label: t("settlements.factTutor"), value: transferLine.tutorName ?? transferLine.tutorUserId },
                {
                  label: t("settlements.factAmount"),
                  value: <Money satang={transferLine.netPayoutSatang} className="text-base font-semibold text-fg" />,
                },
                {
                  label: t("settlements.factBank"),
                  value: bankLabel(transferLine) ?? t("settlements.bankUnknown"),
                },
                ...(transferLine.bankAccountName
                  ? [{ label: t("settlements.factAccountName"), value: transferLine.bankAccountName }]
                  : []),
                { label: t("settlements.factPeriod"), value: periodLabel },
              ]}
            />
          ) : null
        }
        onConfirm={async () => {
          if (!transferLine) return;
          await api.post(`/v1/settlements/${id}/lines/${transferLine.payoutLineId}/transfer`, undefined, {
            idempotencyKey: actionKey,
          });
          toast.success(t("settlements.transferSuccess"));
          await afterMutation();
        }}
      />
      <ConfirmDialog
        open={Boolean(syncLine)}
        onOpenChange={(open) => !open && setSyncLine(null)}
        title={t("settlements.confirmSyncTitle")}
        description={t("settlements.confirmSyncBody", { name: syncLine?.tutorName ?? "" })}
        confirmLabel={t("settlements.syncTransfer")}
        onConfirm={async () => {
          if (!syncLine) return;
          await api.post(`/v1/settlements/${id}/lines/${syncLine.payoutLineId}/sync-transfer`);
          toast.success(t("settlements.syncDone"));
          await refetch();
        }}
      />
    </Page>
  );
}

function formatMoney(satang: string | number) {
  return formatSatang(satangNumber(satang));
}

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ListGroup aria-label={t("settlements.timelineTitle")}>
      {entries.map((entry, index) => (
        <ListRow
          key={`${entry.action}-${entry.at}-${index}`}
          leading={
            entry.action === "APPROVE" ? (
              <CheckCircle2 aria-hidden="true" className="size-5 text-success-fg" />
            ) : entry.action === "REJECT" ? (
              <Undo2 aria-hidden="true" className="size-5 text-danger-fg" />
            ) : (
              <span aria-hidden="true" className="mx-1.5 size-2 rounded-full bg-fg-subtle" />
            )
          }
          title={TIMELINE_LABEL[entry.action] ?? entry.action}
          subtitle={`${entry.actorName ?? t("settlements.unknownActor")} · ${formatThaiDateTime(entry.at, "short")}`}
          meta={
            entry.devOverride || entry.note ? (
              <>
                {entry.devOverride ? <Chip tone="warning" size="sm">{t("settlements.devOverrideChip")}</Chip> : null}
                {entry.note ? <span className="text-[0.8125rem] text-fg-muted">“{entry.note}”</span> : null}
              </>
            ) : undefined
          }
        />
      ))}
    </ListGroup>
  );
}
