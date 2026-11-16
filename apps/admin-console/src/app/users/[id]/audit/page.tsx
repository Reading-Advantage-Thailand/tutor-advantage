"use client";

import { History } from "lucide-react";
import { auditActionLabel } from "@/app/audit/auditLabels";
import { EmptyState, ErrorState, ListSkeleton, Pagination } from "@/components/app";
import { useTableState } from "@/hooks/useTableState";
import { api, ApiError } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import { cn } from "@/lib/utils";
import { fieldLabel, VERIFICATION_FIELDS, useUserDetail, type VerificationField } from "../model";
import { Panel } from "../components/Panel";
import { userDetail } from "@/locales/th/userDetail";
import "@/locales/th/userHeader";

interface AuditItem {
  id: string;
  action: string;
  actorId: string;
  actorName: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

function actionLabel(action: string, payload: Record<string, unknown> | null): string {
  if (action === "USER_VERIFY") {
    return payload?.status === "REJECTED" ? t("userDetail.actionUSER_VERIFY_REJECT") : t("userDetail.actionUSER_VERIFY_APPROVE");
  }
  if (action === "ROLE_CHANGE" && typeof payload?.kind === "string") {
    const kindKey = `roleKind${payload.kind}` as keyof typeof userDetail;
    if (userDetail[kindKey]) return userDetail[kindKey] as string;
  }
  // No wording of its own here: the label /audit shows for the same action
  // (e.g. a tutor account an admin created), so the two never drift apart.
  const key = `action${action}` as keyof typeof userDetail;
  return (userDetail[key] as string | undefined) ?? auditActionLabel(action);
}

/** One short Thai line from the event payload (fields, role change, reason). Never prints PII values. */
function summary(item: AuditItem): string {
  const p = item.payload ?? {};
  const parts: string[] = [];
  if (Array.isArray(p.fields)) {
    const labels = (p.fields as string[])
      .filter((f): f is VerificationField => (VERIFICATION_FIELDS as string[]).includes(f))
      .map((field) => fieldLabel(field));
    if (labels.length) parts.push(`${t("userDetail.auditFields")}: ${labels.join(", ")}`);
  }
  if (typeof p.toRole === "string") {
    const from = typeof p.fromRole === "string" ? statusLabel("userRole", p.fromRole) : "–";
    parts.push(t("userDetail.auditFromTo", { from, to: statusLabel("userRole", p.toRole) }));
  }
  if (p.source === "AUTO_ON_BANKBOOK_VERIFY") parts.push(t("userDetail.omiseAutoCreated"));
  if (p.reasons && typeof p.reasons === "object") {
    parts.push(`${t("userDetail.auditReason")}: ${Object.values(p.reasons as Record<string, string>).join(" / ")}`);
  } else if (typeof p.reason === "string" && p.reason) {
    parts.push(`${t("userDetail.auditReason")}: ${p.reason}`);
  }
  return parts.join(" · ");
}

/**
 * Category dot for the timeline (the action word next to it carries the meaning):
 * approvals and reactivation success, rejections / suspension / erasure danger,
 * payout account changes info, staff roles brand, everything else neutral.
 */
function dotClass(action: string, payload: Record<string, unknown> | null): string {
  if (action === "USER_VERIFY") return payload?.status === "REJECTED" ? "bg-danger-solid" : "bg-success-solid";
  if (action === "USER_UNSUSPEND") return "bg-success-solid";
  if (action === "USER_SUSPEND" || action === "USER_ANONYMIZE") return "bg-danger-solid";
  if (action.startsWith("USER_OMISE")) return "bg-info-solid";
  if (action.startsWith("ROLE_")) return "bg-brand-solid";
  return "bg-fg-subtle";
}

export default function UserAuditTab() {
  const { me, userId } = useUserDetail();
  const table = useTableState({ prefix: "audit", defaultPageSize: 20 });
  const { data, error, isLoading, refetch } = useCachedResource(
    me ? `${me.userId}:users:audit:${userId}:${table.queryKey}` : null,
    () =>
      api.get<{ items: AuditItem[]; total: number }>(`/v1/users/${userId}/audit`, {
        query: { page: table.page, pageSize: table.pageSize },
      }),
    { keepPreviousData: true },
  );

  if (error && !data) {
    return <ErrorState onRetry={refetch} digest={error instanceof ApiError ? (error.requestId ?? undefined) : undefined} />;
  }
  if (isLoading && !data) return <ListSkeleton rows={4} />;
  if (!data?.items.length) return <EmptyState icon={History} title={t("userDetail.auditEmpty")} />;

  return (
    <Panel id="user-audit" title={t("userHeader.tabAudit")} meta={t("shell.itemsCount", { count: formatNumber(data.total) })}>
      {/* Audit trail as a timeline: category dot + action, what changed, then when · who (patterns.md A6). */}
      <ol className="px-4 py-2">
        {data.items.map((item, index) => {
          const detail = summary(item);
          const last = index === data.items.length - 1;
          return (
            <li key={item.id} className="relative flex gap-3 py-3">
              {/* Rail from this dot to the next one (decorative). */}
              {!last ? <span aria-hidden="true" className="absolute top-[1.625rem] -bottom-[1.625rem] left-[0.4375rem] w-0.5 rounded-full bg-hairline-strong" /> : null}
              <span aria-hidden="true" className="relative mt-[0.3125rem] flex size-4 shrink-0 items-center justify-center rounded-full bg-surface">
                <span className={cn("size-2.5 rounded-full", dotClass(item.action, item.payload))} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-[1.6] font-semibold text-fg">{actionLabel(item.action, item.payload)}</p>
                {detail ? <p className="mt-0.5 text-[0.8125rem] leading-[1.6] break-words text-fg-muted">{detail}</p> : null}
                <p className="mt-1 text-xs leading-[1.6] text-fg-muted">
                  <span className="tabular">{formatThaiDateTime(item.createdAt)}</span>
                  {" · "}
                  {t("userDetail.auditBy", {
                    actor: item.actorName ?? (item.actorId === "SYSTEM" ? t("userDetail.auditSystem") : item.actorId.slice(0, 8)),
                  })}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {data.total > table.pageSize ? (
        <div className="border-t border-hairline pr-3 pl-4">
          <Pagination page={table.page} pageSize={table.pageSize} total={data.total} onPageChange={table.setPage} />
        </div>
      ) : null}
    </Panel>
  );
}
