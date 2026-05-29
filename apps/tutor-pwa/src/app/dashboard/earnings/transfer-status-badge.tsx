"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BanknoteIcon,
  CheckCircle2,
  Clock,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { t } from "@/lib/i18n";

type TransferStatusConfig = {
  label: string;
  className: string;
  Icon: typeof CheckCircle2;
};

const transferStatusConfig: Record<string, TransferStatusConfig> = {
  PAID: {
    label: t("dashboardEarnings.transferStatuses.PAID"),
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    Icon: CheckCircle2,
  },
  SENT: {
    label: t("dashboardEarnings.transferStatuses.SENT"),
    className: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20",
    Icon: BanknoteIcon,
  },
  SENT_PENDING: {
    label: t("dashboardEarnings.transferStatuses.SENT_PENDING"),
    className: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20",
    Icon: Send,
  },
  CREATED: {
    label: t("dashboardEarnings.transferStatuses.CREATED"),
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    Icon: Clock,
  },
  PENDING_TRANSFER: {
    label: t("dashboardEarnings.transferStatuses.PENDING_TRANSFER"),
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    Icon: Clock,
  },
  NOT_SENT: {
    label: t("dashboardEarnings.transferStatuses.NOT_SENT"),
    className: "bg-muted text-muted-foreground border-border",
    Icon: Clock,
  },
  TRANSFER_FAILED: {
    label: t("dashboardEarnings.transferStatuses.TRANSFER_FAILED"),
    className: "bg-destructive/10 text-destructive border-destructive/20",
    Icon: XCircle,
  },
  NO_TRANSFER_REQUIRED: {
    label: t("dashboardEarnings.transferStatuses.NO_TRANSFER_REQUIRED"),
    className: "bg-muted text-muted-foreground border-border",
    Icon: CheckCircle2,
  },
};

// Statuses that are not yet final — keep polling Omise until they settle.
const PENDING_STATUSES = ["PENDING_TRANSFER", "CREATED", "SENT_PENDING", "SENT"];

export function TransferStatusBadge({
  payoutLineId,
  initialStatus,
  initialTransferredAt,
}: {
  payoutLineId: string;
  initialStatus: string;
  initialTransferredAt?: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [transferredAt, setTransferredAt] = useState<string | null>(
    initialTransferredAt ?? null,
  );
  const [syncing, setSyncing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/earnings/transfers/${encodeURIComponent(payoutLineId)}/sync`,
        { method: "POST" },
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data?.transfer?.transferStatus) {
        setStatus(data.transfer.transferStatus);
        setTransferredAt(data.transfer.transferredAt ?? null);
      }
    } catch {
      // ignore transient errors
    } finally {
      setSyncing(false);
    }
  }, [payoutLineId]);

  // Auto-poll while the transfer hasn't reached a final state.
  useEffect(() => {
    if (!PENDING_STATUSES.includes(status)) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = setInterval(() => {
      void sync();
    }, 8000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [status, sync]);

  const cfg = transferStatusConfig[status];
  if (!cfg) return null;
  const Icon = cfg.Icon;

  return (
    <div
      className={`mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold w-fit ${cfg.className}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {cfg.label}
      {status === "PAID" && transferredAt && (
        <span className="opacity-60 font-medium">
          ·{" "}
          {new Date(transferredAt).toLocaleDateString("th-TH", {
            month: "short",
            day: "numeric",
          })}
        </span>
      )}
      {status !== "NO_TRANSFER_REQUIRED" && status !== "NOT_SENT" && (
        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          aria-label="refresh transfer status"
          className="ml-0.5 inline-flex items-center disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>
  );
}
