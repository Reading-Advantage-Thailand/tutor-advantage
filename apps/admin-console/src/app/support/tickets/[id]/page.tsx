"use client";

import { use, useState } from "react";
import Link from "next/link";
import { AlarmClock, FileQuestion, UserMinus, UserPlus } from "lucide-react";
import {
  AdminStatusChip,
  Card,
  CardHeader,
  CardSkeleton,
  Chip,
  ConfirmDialog,
  DescriptionList,
  EmptyState,
  ErrorState,
  Notice,
  Page,
  PageHeader,
  PageHeaderSkeleton,
  SplitLayout,
  useAdminSession,
} from "@/components/app";
import { useRefreshAdminSummary } from "@/components/app/adminSummaryContext";
import { toast } from "@/components/app/toastStore";
import { Button } from "@/components/ui/button";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { invalidateResource, mutateResource, useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import { DueCell } from "../components/DueCell";
import { TicketComposer } from "../components/TicketComposer";
import { TicketThread } from "../components/TicketThread";
import {
  assignActions,
  dueState,
  formatTicketNumber,
  STATUS_NOTE_MAX,
  statusTargets,
  ticketDetailKey,
  ticketsListPrefix,
  type AdminTicketDetail,
  type AdminTicketResponse,
  type TicketStatus,
} from "../ticketModel";
import "@/locales/th/tickets";

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useAdminSession();
  const refreshSummary = useRefreshAdminSummary();
  const key = me ? ticketDetailKey(me.userId, id) : null;
  const { data, error, refetch } = useCachedResource(key, () =>
    api.get<AdminTicketResponse>(`/v1/admin/tickets/${encodeURIComponent(id)}`),
  );
  const [pendingStatus, setPendingStatus] = useState<{ status: TicketStatus; key: string } | null>(null);
  const [assigning, setAssigning] = useState<"me" | "none" | null>(null);

  /** After any mutation: show the returned ticket, refresh queue lists and the sidebar badge. */
  const applyTicket = (ticket: AdminTicketDetail) => {
    if (key) mutateResource<AdminTicketResponse>(key, { ticket });
    if (me) invalidateResource(ticketsListPrefix(me.userId));
    void refreshSummary();
  };

  const ticket = data?.ticket;

  if (error && !ticket) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <Page width="medium">
        <PageHeader title={t("tickets.detail.loadError")} backHref="/support/tickets" backLabel={t("tickets.detail.backToList")} />
        {notFound ? (
          <EmptyState icon={FileQuestion} title={t("tickets.detail.notFound")} description={t("tickets.detail.notFoundDescription")} />
        ) : (
          <ErrorState onRetry={refetch} />
        )}
      </Page>
    );
  }

  if (!ticket) {
    return (
      <Page width="medium">
        <PageHeaderSkeleton actions={false} />
        <CardSkeleton lines={8} />
      </Page>
    );
  }

  const number = formatTicketNumber(ticket.ticketNumber);
  const requesterName = ticket.requester.displayName || t("tickets.noName");
  const assign = assignActions(ticket.assignee, me?.userId);
  const overdue = dueState(ticket) === "overdue";

  const onAssign = async (target: "me" | "none") => {
    if (!me || assigning) return;
    setAssigning(target);
    try {
      const result = await api.post<AdminTicketResponse>(
        `/v1/admin/tickets/${encodeURIComponent(ticket.ticketId)}/assign`,
        { assigneeUserId: target === "me" ? me.userId : null },
        { idempotencyKey: newIdempotencyKey() },
      );
      toast.success(target === "me" ? t("tickets.toast.assigned") : t("tickets.toast.unassigned"));
      applyTicket(result.ticket);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("shell.errorTitle"));
    } finally {
      setAssigning(null);
    }
  };

  const onConfirmStatus = async ({ reason }: { reason: string }) => {
    if (!pendingStatus) return;
    const note = reason.trim();
    if (note.length > STATUS_NOTE_MAX) throw new Error(t("tickets.status.noteTooLong", { max: formatNumber(STATUS_NOTE_MAX) }));
    const result = await api.post<AdminTicketResponse>(
      `/v1/admin/tickets/${encodeURIComponent(ticket.ticketId)}/status`,
      note ? { status: pendingStatus.status, note } : { status: pendingStatus.status },
      { idempotencyKey: pendingStatus.key },
    );
    toast.success(t("tickets.toast.statusChanged", { status: statusLabel("ticket", result.ticket.status) }));
    applyTicket(result.ticket);
  };

  const notifies = pendingStatus?.status === "WAITING_ON_REQUESTER" || pendingStatus?.status === "RESOLVED";

  return (
    <Page>
      <PageHeader
        title={
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="text-fg-muted tabular-nums">{number}</span>
            <span className="min-w-0 break-words">{ticket.subject}</span>
          </span>
        }
        appBarTitle={number}
        mobileTitle="inline"
        backHref="/support/tickets"
        backLabel={t("tickets.detail.backToList")}
        meta={
          <>
            <AdminStatusChip domain="ticket" status={ticket.status} size="md" />
            <AdminStatusChip domain="ticketCategory" status={ticket.category} size="md" />
            {overdue ? (
              <Chip tone="danger" icon={AlarmClock}>
                {t("tickets.due.overdue")}
              </Chip>
            ) : null}
            {ticket.awaitingSupport && ticket.status !== "RESOLVED" ? (
              <Chip tone="warning" dot>
                {t("tickets.awaitingSupport")}
              </Chip>
            ) : null}
          </>
        }
        actions={
          <>
            {assign.canUnassign ? (
              <Button variant="ghost" loading={assigning === "none"} disabled={assigning !== null} onClick={() => onAssign("none")}>
                <UserMinus aria-hidden="true" />
                {t("tickets.assign.unassign")}
              </Button>
            ) : null}
            {assign.canAssignToMe ? (
              <Button variant="outline" loading={assigning === "me"} disabled={assigning !== null} onClick={() => onAssign("me")}>
                <UserPlus aria-hidden="true" />
                {ticket.assignee ? t("tickets.assign.takeOver") : t("tickets.assign.toMe")}
              </Button>
            ) : null}
          </>
        }
      />

      {overdue ? <Notice tone="danger">{t("tickets.detail.overdueNotice")}</Notice> : null}

      <SplitLayout
        main={
          <>
            <TicketThread messages={ticket.messages} requesterName={requesterName} />
            <TicketComposer ticket={ticket} onSent={applyTicket} />
          </>
        }
        side={
          <>
            <Card>
              <DescriptionList
                columns={1}
                items={[
                  {
                    label: t("tickets.detail.requester"),
                    value: (
                      <span className="flex min-w-0 flex-col">
                        <Link
                          href={`/users/${encodeURIComponent(ticket.requester.userId)}`}
                          className="truncate font-medium text-brand-fg hover:underline"
                        >
                          {requesterName}
                        </Link>
                        <span className="truncate text-[0.8125rem] text-fg-muted">
                          {statusLabel("userRole", ticket.requester.role)} · {ticket.requester.email ?? t("tickets.noEmail")}
                        </span>
                      </span>
                    ),
                  },
                  { label: t("tickets.detail.class"), value: ticket.classTitle ?? t("tickets.detail.noClass") },
                  {
                    label: t("tickets.detail.paymentReference"),
                    value: ticket.paymentReference ? (
                      <span className="font-mono text-[0.8125rem] break-all">{ticket.paymentReference}</span>
                    ) : (
                      t("tickets.detail.noPaymentReference")
                    ),
                  },
                  { label: t("tickets.detail.createdAt"), value: formatThaiDateTime(ticket.createdAt) },
                  { label: t("tickets.detail.dueAt"), value: <DueCell ticket={ticket} /> },
                  {
                    label: t("tickets.detail.firstResponseAt"),
                    value: ticket.firstResponseAt ? formatThaiDateTime(ticket.firstResponseAt) : t("tickets.detail.notAnswered"),
                  },
                  ...(ticket.resolvedAt
                    ? [{ label: t("tickets.detail.resolvedAt"), value: formatThaiDateTime(ticket.resolvedAt) }]
                    : []),
                  {
                    label: t("tickets.detail.assignee"),
                    value: assign.assignedToMe
                      ? t("tickets.assign.mine")
                      : (ticket.assignee?.displayName ?? (ticket.assignee ? t("tickets.noName") : t("tickets.unassigned"))),
                  },
                ]}
              />
            </Card>

            <Card>
              <CardHeader title={t("tickets.detail.statusSection")} className="mb-3" />
              <div className="flex flex-col gap-2">
                {statusTargets(ticket.status).map((status) => (
                  <Button
                    key={status}
                    variant={status === "RESOLVED" ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setPendingStatus({ status, key: newIdempotencyKey() })}
                  >
                    {t(`tickets.status.to.${status}`)}
                  </Button>
                ))}
              </div>
            </Card>
          </>
        }
      />

      <ConfirmDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        tone="brand"
        title={
          pendingStatus ? t("tickets.status.confirmTitle", { number, status: statusLabel("ticket", pendingStatus.status) }) : ""
        }
        description={notifies ? t("tickets.status.confirmNotifyDescription") : t("tickets.status.confirmDescription")}
        confirmLabel={t("tickets.status.confirm")}
        reason={{ label: t("tickets.status.noteLabel"), placeholder: t("tickets.status.notePlaceholder"), required: false }}
        onConfirm={onConfirmStatus}
      />
    </Page>
  );
}
