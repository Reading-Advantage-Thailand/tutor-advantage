"use client";

import { use, useState } from "react";
import Link from "next/link";
import { AlarmClock, ArrowLeft, CheckCircle2, FileQuestion, UserMinus, UserPlus } from "lucide-react";
import {
  AdminStatusChip,
  Card,
  CardHeader,
  Chip,
  ConfirmDialog,
  DescriptionList,
  EmptyState,
  ErrorState,
  IdCell,
  Notice,
  Page,
  PageHeader,
  UserAvatar,
  useAdminSession,
} from "@/components/app";
import { useRefreshAdminSummary } from "@/components/app/adminSummaryContext";
import { toast } from "@/components/app/toastStore";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { invalidateResource, mutateResource, useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import { DueCell } from "../components/DueCell";
import { TicketComposer } from "../components/TicketComposer";
import { TicketDetailSkeleton } from "../components/TicketDetailSkeleton";
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
          <EmptyState
            icon={FileQuestion}
            title={t("tickets.detail.notFound")}
            description={t("tickets.detail.notFoundDescription")}
            action={
              <Link href="/support/tickets" className={buttonVariants({ variant: "outline" })}>
                <ArrowLeft aria-hidden="true" />
                {t("tickets.detail.backToList")}
              </Link>
            }
          />
        ) : (
          <ErrorState onRetry={refetch} digest={error instanceof ApiError ? (error.requestId ?? undefined) : undefined} />
        )}
      </Page>
    );
  }

  if (!ticket) return <TicketDetailSkeleton />;

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
          <span className="break-words">
            <span className="mr-2 text-fg-muted tabular">{number}</span>
            {ticket.subject}
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
            <IdCell id={ticket.ticketId} />
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

      {/* Two columns from 1280 (thread + facts rail); one column below, thread first. */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="ticket-thread-heading" className="flex min-w-0 flex-col gap-3">
            <h2 id="ticket-thread-heading" className="text-base leading-normal font-semibold text-fg">
              {t("tickets.detail.thread")}
            </h2>
            <TicketThread messages={ticket.messages} requesterName={requesterName} requesterId={ticket.requester.userId} />
          </section>
          <TicketComposer ticket={ticket} onSent={applyTicket} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <div className="mb-4 flex min-w-0 items-center gap-3 border-b border-hairline pb-4">
              <UserAvatar name={requesterName} seed={ticket.requester.userId} decorative />
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.8125rem] leading-normal text-fg-muted">{t("tickets.detail.requester")}</span>
                <Link
                  href={`/users/${encodeURIComponent(ticket.requester.userId)}`}
                  className="flex min-w-0 self-start rounded-(--radius-ctl-sm) text-sm leading-normal font-semibold text-brand-fg hover:underline pointer-coarse:min-h-11 pointer-coarse:items-center"
                  title={requesterName}
                >
                  <span className="truncate">{requesterName}</span>
                </Link>
                {/* The record screen shows the whole email (patterns.md "Thai text"): it wraps, never cut. */}
                <span
                  className="text-[0.8125rem] leading-normal text-fg-muted [overflow-wrap:anywhere]"
                  title={ticket.requester.email ?? undefined}
                >
                  {statusLabel("userRole", ticket.requester.role)} · {ticket.requester.email ?? t("tickets.noEmail")}
                </span>
              </span>
            </div>
            <DescriptionList
              className="xl:grid-cols-1"
              items={[
                { label: t("tickets.detail.class"), value: ticket.classTitle ?? t("tickets.detail.noClass") },
                {
                  label: t("tickets.detail.paymentReference"),
                  value: ticket.paymentReference ? (
                    <span className="font-mono text-[0.8125rem] [overflow-wrap:anywhere]">{ticket.paymentReference}</span>
                  ) : (
                    t("tickets.detail.noPaymentReference")
                  ),
                },
                { label: t("tickets.detail.createdAt"), value: <span className="tabular">{formatThaiDateTime(ticket.createdAt)}</span> },
                { label: t("tickets.detail.dueAt"), value: <DueCell ticket={ticket} /> },
                {
                  label: t("tickets.detail.firstResponseAt"),
                  value: ticket.firstResponseAt ? (
                    <span className="tabular">{formatThaiDateTime(ticket.firstResponseAt)}</span>
                  ) : (
                    t("tickets.detail.notAnswered")
                  ),
                },
                ...(ticket.resolvedAt
                  ? [{ label: t("tickets.detail.resolvedAt"), value: <span className="tabular">{formatThaiDateTime(ticket.resolvedAt)}</span> }]
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
            <div className="flex flex-wrap gap-2 xl:flex-col">
              {statusTargets(ticket.status).map((status) => (
                <Button
                  key={status}
                  variant={status === "RESOLVED" ? "tonal" : "outline"}
                  className="justify-start xl:w-full"
                  onClick={() => setPendingStatus({ status, key: newIdempotencyKey() })}
                >
                  {status === "RESOLVED" ? <CheckCircle2 aria-hidden="true" /> : null}
                  {t(`tickets.status.to.${status}`)}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      </div>

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
