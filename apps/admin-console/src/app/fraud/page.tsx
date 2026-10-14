"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, Lock, LockOpen, RotateCcw, ShieldAlert, ShieldCheck, ShieldX, TriangleAlert, UserRound } from "lucide-react";
import {
  AdminStatusChip,
  Chip,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilterBar,
  Grid,
  Page,
  PageHeader,
  Pagination,
  SelectField,
  StatCard,
  useAdminSession,
  useHasRole,
  type DataTableColumn,
} from "@/components/app";
import { useRefreshAdminSummary } from "@/components/app/adminSummaryContext";
import { ConfirmDialog } from "@/components/app/ConfirmDialog";
import { toast } from "@/components/app/toastStore";
import { Button, buttonVariants } from "@/components/ui/button";
import { useTableState } from "@/hooks/useTableState";
import { api, newIdempotencyKey } from "@/lib/api";
import { invalidateResource, useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatThaiDateTime } from "@/lib/format";
import { t, type I18nKey } from "@/lib/i18n";
import { statusLabel, statusOptions } from "@/lib/status";
import "@/locales/th/fraud";

type FraudAction = "INVESTIGATE" | "MONITOR" | "FREEZE" | "UNFREEZE" | "CLEAR";

interface FraudFlag {
  id: string;
  type: string;
  severity: string;
  targetId: string;
  targetName: string | null;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  target: { userId: string; role: string; isActive: boolean; displayName: string | null; email: string | null } | null;
}

interface FraudResponse {
  flags: FraudFlag[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    activeCount: number;
    highRiskCount: number;
    frozenCount: number;
    suspendedTargetCount: number;
    frozenButActiveCount: number;
  };
}

interface ActionResult {
  flag: { id: string; status: string };
  user: { userId: string; isActive: boolean } | null;
  userChanged: boolean;
  userNote: string;
}

const COPY: Record<FraudAction, { title: I18nKey; confirm: I18nKey; danger?: boolean }> = {
  FREEZE: { title: "fraud.confirm.freezeTitle", confirm: "fraud.confirm.freezeConfirm", danger: true },
  UNFREEZE: { title: "fraud.confirm.unfreezeTitle", confirm: "fraud.confirm.unfreezeConfirm" },
  CLEAR: { title: "fraud.confirm.clearTitle", confirm: "fraud.confirm.clearConfirm" },
  MONITOR: { title: "fraud.confirm.monitorTitle", confirm: "fraud.confirm.monitorConfirm" },
  INVESTIGATE: { title: "fraud.confirm.investigateTitle", confirm: "fraud.confirm.investigateConfirm" },
};

function describe(action: FraudAction, flag: FraudFlag): string {
  const frozen = flag.status === "FROZEN";
  switch (action) {
    case "FREEZE":
      return t("fraud.confirm.freezeDescription");
    case "UNFREEZE":
      return t("fraud.confirm.unfreezeDescription");
    case "CLEAR":
      return frozen ? t("fraud.confirm.clearFrozenDescription") : t("fraud.confirm.clearDescription");
    case "MONITOR":
      return frozen ? t("fraud.confirm.monitorFrozenDescription") : t("fraud.confirm.monitorDescription");
    default:
      return t("fraud.confirm.investigateDescription");
  }
}

function resultMessage(action: FraudAction, result: ActionResult): string {
  if (action === "FREEZE") return result.userChanged ? t("fraud.toast.frozen") : t("fraud.toast.frozenAlready");
  if (result.userNote === "RELEASED" && result.userChanged) return t("fraud.toast.released");
  if (result.userNote === "OTHER_FROZEN_FLAGS") return t("fraud.toast.releasedKeptOther");
  if (result.userNote === "SUSPENDED_ELSEWHERE") return t("fraud.toast.releasedKeptElsewhere");
  return t("fraud.toast.updated");
}

function targetLabel(flag: FraudFlag) {
  return flag.targetName ?? flag.target?.displayName ?? flag.target?.email ?? t("fraud.unknownTarget");
}

function AccountState({ flag }: { flag: FraudFlag }) {
  if (!flag.target) return <span className="text-[0.8125rem] text-fg-muted">{t("fraud.notUser")}</span>;
  const suspended = !flag.target.isActive;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <AdminStatusChip domain="account" status={suspended ? "SUSPENDED" : "ACTIVE"} />
      {flag.status === "FROZEN" && !suspended ? (
        <Chip size="sm" tone="warning" icon={TriangleAlert}>
          {t("fraud.frozenButActiveChip")}
        </Chip>
      ) : null}
    </div>
  );
}

export default function FraudFlagsPage() {
  const me = useAdminSession();
  const isAdmin = useHasRole("ADMIN");
  const refreshSummary = useRefreshAdminSummary();
  const table = useTableState({
    defaultSort: { key: "createdAt", dir: "desc" },
    sortKeys: ["createdAt"],
    filterKeys: ["status", "severity"],
    defaultFilters: { status: "ACTIVE" },
  });
  const [pending, setPending] = useState<{ flag: FraudFlag; action: FraudAction; key: string } | null>(null);
  const status = table.filters.status || "ALL";
  const severity = table.filters.severity ?? "";

  const query = {
    status,
    severity: severity || undefined,
    q: table.q || undefined,
    page: table.page,
    pageSize: table.pageSize,
    order: table.sort?.dir,
  };
  const { data, error, isLoading, isValidating, isPreviousData, refetch } = useCachedResource(
    me ? `${me.userId}:fraud:${JSON.stringify(query)}` : null,
    () => api.get<FraudResponse>("/v1/fraud-flags", { query }),
    { keepPreviousData: true },
  );
  const stats = data?.stats;

  const columns: DataTableColumn<FraudFlag>[] = useMemo(() => {
    const open = (flag: FraudFlag, action: FraudAction) => setPending({ flag, action, key: newIdempotencyKey() });
    return [
      {
        key: "target",
        header: t("fraud.columns.target"),
        label: t("fraud.columns.target"),
        alwaysVisible: true,
        mobile: "primary",
        cell: (flag) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-fg">{targetLabel(flag)}</span>
            <span className="truncate text-[0.8125rem] text-fg-muted">
              {flag.target ? statusLabel("userRole", flag.target.role) : t("fraud.notUser")}
            </span>
          </div>
        ),
      },
      {
        key: "createdAt",
        header: t("fraud.columns.createdAt"),
        sortable: true,
        mobile: "secondary",
        cell: (flag) => <span className="whitespace-nowrap">{formatThaiDateTime(flag.createdAt)}</span>,
      },
      {
        key: "type",
        header: t("fraud.columns.type"),
        label: t("fraud.columns.type"),
        width: "220px",
        cell: (flag) => (
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className="text-fg">{statusLabel("fraudType", flag.type)}</span>
            <span className="line-clamp-2 text-[0.8125rem] text-fg-muted" title={flag.description}>
              {flag.description || t("fraud.noDescription")}
            </span>
          </div>
        ),
      },
      {
        key: "severity",
        header: t("fraud.columns.severity"),
        label: t("fraud.columns.severity"),
        cell: (flag) => <AdminStatusChip domain="fraudSeverity" status={flag.severity} />,
      },
      {
        key: "status",
        header: t("fraud.columns.status"),
        label: t("fraud.columns.status"),
        mobile: "trailing",
        cell: (flag) => <AdminStatusChip domain="fraudFlag" status={flag.status} />,
      },
      {
        key: "account",
        header: t("fraud.columns.account"),
        label: t("fraud.columns.account"),
        cell: (flag) => <AccountState flag={flag} />,
      },
      {
        key: "actions",
        width: "260px",
        header: <span className="sr-only">{t("fraud.columns.actions")}</span>,
        label: t("fraud.columns.actions"),
        alwaysVisible: true,
        align: "right",
        cell: (flag) => {
          const frozen = flag.status === "FROZEN";
          const canTouchFrozen = isAdmin || !frozen;
          return (
            <div className="flex flex-wrap justify-start gap-1.5 md:justify-end">
              {isAdmin && flag.target && (!frozen || flag.target.isActive) ? (
                <Button size="sm" variant="danger" onClick={() => open(flag, "FREEZE")}>
                  <Lock aria-hidden="true" />
                  {frozen ? t("fraud.actions.enforceFreeze") : t("fraud.actions.freeze")}
                </Button>
              ) : null}
              {isAdmin && frozen ? (
                <Button size="sm" variant="outline" onClick={() => open(flag, "UNFREEZE")}>
                  <LockOpen aria-hidden="true" />
                  {t("fraud.actions.unfreeze")}
                </Button>
              ) : null}
              {canTouchFrozen && flag.status !== "MONITORING" && flag.status !== "CLEARED" && !frozen ? (
                <Button size="sm" variant="outline" onClick={() => open(flag, "MONITOR")}>
                  <Eye aria-hidden="true" />
                  {t("fraud.actions.monitor")}
                </Button>
              ) : null}
              {canTouchFrozen && flag.status !== "CLEARED" ? (
                <Button size="sm" variant="ghost" onClick={() => open(flag, "CLEAR")}>
                  <ShieldCheck aria-hidden="true" />
                  {t("fraud.actions.clear")}
                </Button>
              ) : null}
              {flag.status === "CLEARED" ? (
                <Button size="sm" variant="ghost" onClick={() => open(flag, "INVESTIGATE")}>
                  <RotateCcw aria-hidden="true" />
                  {t("fraud.actions.investigate")}
                </Button>
              ) : null}
              {isAdmin && flag.target ? (
                <Link
                  href={`/users/${flag.target.userId}`}
                  className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
                  aria-label={`${t("fraud.actions.openUser")} ${targetLabel(flag)}`}
                  title={t("fraud.actions.openUser")}
                >
                  <UserRound aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          );
        },
      },
    ];
  }, [isAdmin]);

  const onConfirm = async ({ reason }: { reason: string }) => {
    if (!pending) return;
    const result = await api.post<ActionResult>(
      `/v1/fraud-flags/${pending.flag.id}/action`,
      { action: pending.action, reason },
      { idempotencyKey: pending.key },
    );
    toast.success(resultMessage(pending.action, result));
    if (me) invalidateResource(`${me.userId}:fraud:`);
    void refreshSummary();
  };

  const target = pending?.flag;
  const copy = pending ? COPY[pending.action] : null;
  const isFiltered = table.q !== "" || status !== "ACTIVE" || severity !== "";

  return (
    <Page>
      <PageHeader title={t("fraud.page.title")} description={t("fraud.page.description")} />

      <Grid cols={4} className="grid-cols-2">
        <StatCard
          icon={ShieldAlert}
          tone="amber"
          label={t("fraud.stats.active")}
          value={stats ? formatNumber(stats.activeCount) : "…"}
          hint={t("fraud.stats.activeHint")}
        />
        <StatCard
          icon={TriangleAlert}
          tone="red"
          label={t("fraud.stats.highRisk")}
          value={stats ? formatNumber(stats.highRiskCount) : "…"}
          hint={t("fraud.stats.highRiskHint")}
        />
        <StatCard
          icon={Lock}
          tone="neutral"
          label={t("fraud.stats.suspended")}
          value={stats ? formatNumber(stats.suspendedTargetCount) : "…"}
          hint={t("fraud.stats.suspendedHint", { count: formatNumber(stats?.frozenCount ?? 0) })}
        />
        <StatCard
          icon={ShieldX}
          tone={stats && stats.frozenButActiveCount > 0 ? "red" : "teal"}
          label={t("fraud.stats.frozenButActive")}
          value={stats ? formatNumber(stats.frozenButActiveCount) : "…"}
          hint={t("fraud.stats.frozenButActiveHint")}
        />
      </Grid>

      <FilterBar
        search={{ value: table.searchValue, onValueChange: table.setSearchValue, placeholder: t("fraud.filters.search") }}
        isFiltered={isFiltered}
        onReset={table.reset}
      >
        <SelectField
          aria-label={t("fraud.filters.status")}
          containerClassName="w-full sm:w-48"
          value={status}
          onChange={(event) => table.setFilter("status", event.target.value)}
          options={[
            { value: "ACTIVE", label: t("fraud.filters.statusActive") },
            { value: "ALL", label: t("fraud.filters.statusAll") },
            ...statusOptions("fraudFlag"),
          ]}
        />
        <SelectField
          aria-label={t("fraud.filters.severity")}
          containerClassName="w-full sm:w-40"
          value={severity}
          onChange={(event) => table.setFilter("severity", event.target.value)}
          options={statusOptions("fraudSeverity", { all: t("fraud.filters.severityAll") })}
        />
      </FilterBar>

      {error && !data ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <DataTable
          caption={t("fraud.page.title")}
          rows={data?.flags ?? []}
          columns={columns}
          getRowKey={(flag) => flag.id}
          loading={isLoading || (isValidating && isPreviousData)}
          sort={table.sort}
          onSortChange={table.toggleSort}
          empty={<EmptyState compact icon={ShieldCheck} tone="teal" title={t("fraud.empty.title")} description={t("fraud.empty.description")} />}
          footer={
            <Pagination
              page={table.page}
              pageSize={table.pageSize}
              total={data?.total ?? 0}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          }
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        tone={copy?.danger ? "danger" : "brand"}
        title={copy && target ? t(copy.title, { name: targetLabel(target) }) : ""}
        description={pending ? describe(pending.action, pending.flag) : undefined}
        confirmLabel={copy ? t(copy.confirm) : ""}
        reason={{ label: t("fraud.confirm.reasonLabel"), placeholder: t("fraud.confirm.reasonPlaceholder") }}
        details={
          target ? (
            <DescriptionList
              columns={2}
              items={[
                { label: t("fraud.confirm.target"), value: targetLabel(target) },
                {
                  label: t("fraud.confirm.currentAccount"),
                  value: target.target
                    ? statusLabel("account", target.target.isActive ? "ACTIVE" : "SUSPENDED")
                    : t("fraud.notUser"),
                },
                {
                  label: t("fraud.confirm.flag"),
                  value: `${statusLabel("fraudType", target.type)} · ${statusLabel("fraudSeverity", target.severity)}`,
                },
                { label: t("fraud.columns.status"), value: statusLabel("fraudFlag", target.status) },
              ]}
            />
          ) : null
        }
        onConfirm={onConfirm}
      />
    </Page>
  );
}
