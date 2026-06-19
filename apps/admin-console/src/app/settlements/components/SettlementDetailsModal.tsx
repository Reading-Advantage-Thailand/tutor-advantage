import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ReceiptText, Download, UserCircle, Loader2, RefreshCw, Send } from "lucide-react";
import { CopyButton } from "./CopyButton";
import {
  LinesData,
  PayoutLineRow,
  ELIGIBILITY_CONFIG,
  DOCUMENT_STATUS_CONFIG,
  TRANSFER_STATUS_CONFIG,
} from "../types";

interface SettlementDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linesData: LinesData | null;
  userRole: string;
  handleExport: (snapshotId: string, periodMonth: string) => void;
  syncLoadingId: string | null;
  handleSyncTransfer: (row: PayoutLineRow) => void;
  transferLoadingId: string | null;
  handleRetryTransfer: (row: PayoutLineRow) => void;
  handleRefreshDraft?: () => void;
  refreshLoading?: boolean;
}

export function SettlementDetailsModal({
  open,
  onOpenChange,
  linesData,
  userRole,
  handleExport,
  syncLoadingId,
  handleSyncTransfer,
  transferLoadingId,
  handleRetryTransfer,
  handleRefreshDraft,
  refreshLoading,
}: SettlementDetailsModalProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[80vh] flex flex-col p-0 rounded-t-3xl"
      >
        <SheetHeader className="px-6 py-4 border-b bg-muted/20 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg font-bold">
                รายการจ่ายเงิน — {linesData?.periodMonth}
              </SheetTitle>
              <SheetDescription className="mt-0.5">
                {linesData?.lines.length ?? 0} รายการ &nbsp;·&nbsp; ยอดสุทธิรวม{" "}
                <span className="font-bold text-foreground">
                  {(linesData?.totalNetPayoutTHB ?? 0).toLocaleString("th-TH", {
                    style: "currency",
                    currency: "THB",
                  })}
                </span>
                &nbsp;·&nbsp; สถานะ{" "}
                <span className="font-bold text-foreground">{linesData?.status}</span>
              </SheetDescription>
            </div>
            <div className="flex gap-2">
              {linesData && linesData.status === "DRAFT" && handleRefreshDraft && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl font-bold"
                  disabled={refreshLoading}
                  onClick={handleRefreshDraft}
                >
                  {refreshLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  รีเฟรชข้อมูล
                </Button>
              )}
              {linesData && linesData.status === "APPROVED" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl font-bold"
                  onClick={() =>
                    handleExport(linesData.snapshotId, linesData.periodMonth)
                  }
                >
                  <Download className="h-4 w-4 mr-2" />
                  ดาวน์โหลด CSV
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-6 py-4">
          {!linesData || linesData.lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <ReceiptText className="h-12 w-12 opacity-20" />
              <p className="font-medium">ไม่มีรายการในรอบนี้</p>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">รหัสครู</th>
                    <th className="px-4 py-3 text-right">ยอดขายรวม</th>
                    <th className="px-4 py-3 text-right">อัตราจ่าย</th>
                    <th className="px-4 py-3 text-right">ค่าตอบแทน</th>
                    <th className="px-4 py-3 text-right">ปรับยอด</th>
                    <th className="px-4 py-3 text-right">โบนัส Badge</th>
                    <th className="px-4 py-3 text-right">รวมก่อนภาษี</th>
                    <th className="px-4 py-3 text-right">ภาษีหัก ณ ที่จ่าย</th>
                    <th className="px-4 py-3 text-right font-black text-foreground">สุทธิ</th>
                    <th className="px-4 py-3 text-center">สถานะ</th>
                    <th className="px-4 py-3 text-left">50 Tawi</th>
                    <th className="px-4 py-3 text-left">Transfer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {linesData.lines.map((row, i) => (
                    <tr
                      key={row.payoutLineId}
                      className={`transition-colors hover:bg-muted/30 ${
                        i % 2 === 0 ? "bg-background" : "bg-muted/10"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <UserCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-xs text-foreground truncate max-w-[140px]">
                              {row.tutorName ?? <span className="italic text-muted-foreground">ไม่มีชื่อ</span>}
                            </span>
                          </div>
                          {row.tutorEmail && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-[160px] pl-5">
                              {row.tutorEmail}
                            </p>
                          )}
                          <div className="flex items-center gap-1 pl-5">
                            <span className="font-mono text-[10px] text-muted-foreground/70">
                              {row.tutorUserId.slice(0, 8)}…
                            </span>
                            <CopyButton text={row.tutorUserId} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.grossVolumeTHB.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {(row.payoutRate * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {(row.basePayoutTHB ?? row.grossPayoutTHB - row.badgeBonusTHB - (row.adjustmentTHB ?? 0)).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-4 py-3 text-right tabular-nums ${
                        (row.adjustmentTHB ?? 0) > 0
                          ? "text-blue-500"
                          : (row.adjustmentTHB ?? 0) < 0
                            ? "text-red-500"
                            : "text-muted-foreground"
                      }`}>
                        {(row.adjustmentTHB ?? 0) !== 0
                          ? `${(row.adjustmentTHB ?? 0) > 0 ? "+" : ""}${(row.adjustmentTHB ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
                        {row.badgeBonusTHB > 0
                          ? `+${row.badgeBonusTHB.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {row.grossPayoutTHB.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-500">
                        {row.whtTHB > 0
                          ? `-${row.whtTHB.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-foreground">
                        {row.netPayoutTHB.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const ec = ELIGIBILITY_CONFIG[row.eligibilityStatus] ?? {
                            label: row.eligibilityStatus,
                            className: "bg-muted text-muted-foreground border border-border",
                          };
                          return (
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${ec.className}`}>
                              {ec.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                        <div className="flex flex-col gap-1">
                          <span>{row.documentNumber ?? "—"}</span>
                          {row.documentStatus && (
                            <span className="font-sans text-[10px] uppercase">
                              {DOCUMENT_STATUS_CONFIG[row.documentStatus] ?? row.documentStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              TRANSFER_STATUS_CONFIG[row.transferStatus ?? "NOT_SENT"]?.className ??
                              "bg-muted text-muted-foreground border border-border"
                            }`}
                          >
                            {TRANSFER_STATUS_CONFIG[row.transferStatus ?? "NOT_SENT"]?.label ??
                              row.transferStatus ??
                              "ยังไม่ได้โอน"}
                          </span>
                          {row.transferId && (
                            <span className="font-mono text-muted-foreground">
                              {row.transferId}
                            </span>
                          )}
                          {row.transferFailureMessage && (
                            <span className="text-red-500">
                              {row.transferFailureMessage}
                            </span>
                          )}
                          {(() => {
                            const activeTransferStatuses = [
                              "PENDING_TRANSFER",
                              "CREATED",
                              "SENT_PENDING",
                              "SENT",
                              "PAID",
                            ];
                            const canRetryTransfer =
                              userRole === "FINANCE_CHECKER" &&
                              linesData.status === "APPROVED" &&
                              row.netPayoutTHB > 0 &&
                              (row.canSendTransfer ??
                                !activeTransferStatuses.includes(row.transferStatus ?? "NOT_SENT"));

                            // Show a "refresh status" button whenever an Omise
                            // transfer exists but hasn't settled yet, so admins
                            // can pull the latest state from Omise on demand.
                            const canSyncTransfer =
                              Boolean(row.transferId) &&
                              ["PENDING_TRANSFER", "CREATED", "SENT_PENDING", "SENT"].includes(
                                row.transferStatus ?? "NOT_SENT",
                              );

                            return (
                              <div className="flex flex-col gap-1">
                                {canSyncTransfer && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={syncLoadingId === row.payoutLineId}
                                    onClick={() => handleSyncTransfer(row)}
                                    className="mt-1 h-7 rounded-lg px-2 text-[10px] font-bold"
                                  >
                                    {syncLoadingId === row.payoutLineId ? (
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    ) : (
                                      <RefreshCw className="mr-1 h-3 w-3" />
                                    )}
                                    ดึงสถานะ
                                  </Button>
                                )}
                                {canRetryTransfer ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={transferLoadingId === row.payoutLineId}
                                    onClick={() => handleRetryTransfer(row)}
                                    className="mt-1 h-7 rounded-lg px-2 text-[10px] font-bold"
                                  >
                                    {transferLoadingId === row.payoutLineId ? (
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    ) : (
                                      <Send className="mr-1 h-3 w-3" />
                                    )}
                                    ส่งโอนอีกครั้ง
                                  </Button>
                                ) : (
                                  !canSyncTransfer && row.transferBlockedReason ? (
                                    <span className="text-[10px] font-medium text-amber-500">
                                      {row.transferBlockedReason}
                                    </span>
                                  ) : null
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30 border-t-2 border-border font-bold">
                  <tr>
                    <td className="px-4 py-3 text-xs uppercase tracking-wider" colSpan={8}>
                      รวมทั้งหมด ({linesData.lines.length} ราย)
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-brand-600">
                      {linesData.totalNetPayoutTHB.toLocaleString("th-TH", {
                        style: "currency",
                        currency: "THB",
                      })}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
