"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BanknoteIcon, CheckCircle2, Clock, RefreshCw, Send, XCircle, type LucideIcon } from "lucide-react";
import { StatusChip, type Tone } from "@/components/app";
import { usePolling } from "@/hooks/usePolling";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isPendingTransfer } from "./lib/earnings";

/** One poll for every pending payout row on the page (visibility-aware). */
export const TRANSFER_POLL_MS = 15_000;

type TransferEntry = { status: string; transferredAt: string | null };

type TransferStatusConfig = { label: string; tone: Tone; icon: LucideIcon };

const transferStatusConfig: Record<string, TransferStatusConfig> = {
  PAID: { label: t("dashboardEarnings.transferStatuses.PAID"), tone: "success", icon: CheckCircle2 },
  SENT: { label: t("dashboardEarnings.transferStatuses.SENT"), tone: "info", icon: BanknoteIcon },
  SENT_PENDING: { label: t("dashboardEarnings.transferStatuses.SENT_PENDING"), tone: "info", icon: Send },
  CREATED: { label: t("dashboardEarnings.transferStatuses.CREATED"), tone: "warning", icon: Clock },
  PENDING_TRANSFER: { label: t("dashboardEarnings.transferStatuses.PENDING_TRANSFER"), tone: "warning", icon: Clock },
  NOT_SENT: { label: t("dashboardEarnings.transferStatuses.NOT_SENT"), tone: "neutral", icon: Clock },
  TRANSFER_FAILED: { label: t("dashboardEarnings.transferStatuses.TRANSFER_FAILED"), tone: "danger", icon: XCircle },
  NO_TRANSFER_REQUIRED: {
    label: t("dashboardEarnings.transferStatuses.NO_TRANSFER_REQUIRED"),
    tone: "neutral",
    icon: CheckCircle2,
  },
};

interface TransferStatusContextValue {
  entries: Record<string, TransferEntry>;
  syncing: Record<string, boolean>;
  refresh: (payoutLineId: string) => Promise<void>;
}

const TransferStatusContext = createContext<TransferStatusContextValue | null>(null);

async function syncTransfer(payoutLineId: string): Promise<TransferEntry | null> {
  try {
    const res = await fetch(`/api/earnings/transfers/${encodeURIComponent(payoutLineId)}/sync`, { method: "POST" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.transfer?.transferStatus) {
      return { status: data.transfer.transferStatus, transferredAt: data.transfer.transferredAt ?? null };
    }
  } catch {
    // ignore transient errors
  }
  return null;
}

/**
 * Holds the live transfer status of every payout row and runs ONE poller
 * that syncs all rows still in a non-final state. Stops when nothing is
 * pending; pauses while the tab is hidden.
 */
export function TransferStatusProvider({
  initial,
  children,
}: {
  initial: { payoutLineId: string; status: string; transferredAt?: string | null }[];
  children: ReactNode;
}) {
  const [entries, setEntries] = useState<Record<string, TransferEntry>>(() =>
    Object.fromEntries(initial.map((row) => [row.payoutLineId, { status: row.status, transferredAt: row.transferredAt ?? null }])),
  );
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  const apply = useCallback((payoutLineId: string, next: TransferEntry | null) => {
    if (!next) return;
    setEntries((prev) => ({ ...prev, [payoutLineId]: next }));
  }, []);

  const pendingIds = useMemo(
    () => Object.keys(entries).filter((id) => isPendingTransfer(entries[id].status)),
    [entries],
  );
  const pendingRef = useRef(pendingIds);
  pendingRef.current = pendingIds;

  usePolling(
    async () => {
      const ids = pendingRef.current;
      const results = await Promise.all(ids.map((id) => syncTransfer(id)));
      ids.forEach((id, i) => apply(id, results[i]));
    },
    { interval: TRANSFER_POLL_MS, enabled: pendingIds.length > 0, immediate: false },
  );

  const refresh = useCallback(
    async (payoutLineId: string) => {
      setSyncing((prev) => ({ ...prev, [payoutLineId]: true }));
      try {
        apply(payoutLineId, await syncTransfer(payoutLineId));
      } finally {
        setSyncing((prev) => ({ ...prev, [payoutLineId]: false }));
      }
    },
    [apply],
  );

  const value = useMemo(() => ({ entries, syncing, refresh }), [entries, syncing, refresh]);
  return <TransferStatusContext.Provider value={value}>{children}</TransferStatusContext.Provider>;
}

/** Transfer status chip (+ manual refresh) for one payout row. */
export function TransferStatusBadge({ payoutLineId }: { payoutLineId: string }) {
  const context = useContext(TransferStatusContext);
  const entry = context?.entries[payoutLineId];
  if (!context || !entry) return null;
  const cfg = transferStatusConfig[entry.status];
  if (!cfg) return null;

  const busy = Boolean(context.syncing[payoutLineId]);
  const paidOn = entry.status === "PAID" && entry.transferredAt ? formatThaiDate(entry.transferredAt, "short") : "";

  return (
    <span className="inline-flex items-center gap-1">
      <StatusChip
        status={entry.status}
        tone={cfg.tone}
        icon={cfg.icon}
        size="sm"
        label={paidOn ? `${cfg.label} · ${paidOn}` : cfg.label}
      />
      {entry.status !== "NO_TRANSFER_REQUIRED" && entry.status !== "NOT_SENT" ? (
        <button
          type="button"
          onClick={() => void context.refresh(payoutLineId)}
          disabled={busy}
          aria-label={t("dashboardEarnings.refreshTransfer")}
          title={t("dashboardEarnings.refreshTransfer")}
          className="inline-flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-press hover:text-fg disabled:opacity-50"
        >
          <RefreshCw aria-hidden="true" className={cn("size-3.5", busy && "animate-spin")} />
        </button>
      ) : null}
    </span>
  );
}
