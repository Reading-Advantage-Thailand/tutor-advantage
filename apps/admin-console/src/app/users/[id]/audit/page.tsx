"use client";

import { History } from "lucide-react";
import { EmptyState, ErrorState, ListGroup, ListRow, ListSkeleton, Pagination } from "@/components/app";
import { useTableState } from "@/hooks/useTableState";
import { api } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatThaiDateTime } from "@/lib/format";
import { t, th } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import { fieldLabel, VERIFICATION_FIELDS, useUserDetail, type VerificationField } from "../model";

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
    const kindKey = `roleKind${payload.kind}` as keyof typeof th.userDetail;
    if (th.userDetail[kindKey]) return th.userDetail[kindKey] as string;
  }
  const key = `action${action}` as keyof typeof th.userDetail;
  return (th.userDetail[key] as string | undefined) ?? action.replace(/_/g, " ").toLowerCase();
}

/** One short Thai line from the event payload (fields, role change, reason). Never prints PII values. */
function summary(item: AuditItem): string {
  const p = item.payload ?? {};
  const parts: string[] = [];
  if (Array.isArray(p.fields)) {
    const labels = (p.fields as string[])
      .filter((f): f is VerificationField => (VERIFICATION_FIELDS as string[]).includes(f))
      .map(fieldLabel);
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

  if (error && !data) return <ErrorState onRetry={refetch} />;
  if (isLoading && !data) return <ListSkeleton rows={4} />;
  if (!data?.items.length) return <EmptyState icon={History} title={t("userDetail.auditEmpty")} compact />;

  return (
    <ListGroup
      footer={
        data.total > table.pageSize ? (
          <Pagination page={table.page} pageSize={table.pageSize} total={data.total} onPageChange={table.setPage} />
        ) : undefined
      }
    >
      {data.items.map((item) => (
        <ListRow
          key={item.id}
          title={actionLabel(item.action, item.payload)}
          subtitle={summary(item) || undefined}
          lines={2}
          meta={`${formatThaiDateTime(item.createdAt)} · ${t("userDetail.auditBy", {
            actor: item.actorName ?? (item.actorId === "SYSTEM" ? t("userDetail.auditSystem") : item.actorId.slice(0, 8)),
          })}`}
        />
      ))}
    </ListGroup>
  );
}
