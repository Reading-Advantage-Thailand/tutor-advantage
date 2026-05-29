"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { downloadBlob, fetchBlobWithAuth, fetchWithAuth, getAdminRole } from "../../lib/api";
import { CopyableId } from "@/components/ui/copyable-id";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  ClockIcon,
  PlayCircle,
  ShieldCheck,
  ReceiptText,
  XCircle,
  Download,
  Copy,
  Check,
  RefreshCw,
  FileText,
  Info,
  Eye,
  Loader2,
  UserCircle,
  Send,
  X,
} from "lucide-react";

import { t } from "@/lib/i18n";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** Icon-only copy button used inside the payout lines table */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      title="คัดลอก ID"
      aria-label="คัดลอก ID"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

interface PayoutLineRow {
  payoutLineId: string;
  tutorUserId: string;
  tutorName: string | null;
  tutorEmail: string | null;
  grossVolumeTHB: number;
  payoutRate: number;
  basePayoutTHB: number;
  adjustmentTHB: number;
  grossPayoutTHB: number;
  badgeBonusTHB: number;
  whtTHB: number;
  netPayoutTHB: number;
  eligibilityStatus: string;
  documentNumber: string | null;
  documentStatus: string | null;
  transferProvider: string | null;
  transferId: string | null;
  transferStatus: string | null;
  transferFailureCode: string | null;
  transferFailureMessage: string | null;
  transferredAt: string | null;
  canSendTransfer?: boolean;
  transferBlockedReason?: string | null;
}

interface LinesData {
  snapshotId: string;
  periodMonth: string;
  status: string;
  totalNetPayoutTHB: number;
  lines: PayoutLineRow[];
}

export interface SettlementPreview {
  snapshotId: string;
  periodMonth: string;
  totalPayoutSatang?: number;    // gross before WHT
  totalNetPayoutSatang?: number; // net after WHT — shown in result card
  status: string;
  createdBy?: string;
  createdAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  payoutLineCount?: number;
  pendingAdjustmentCount?: number;
}

const ELIGIBILITY_CONFIG: Record<string, { label: string; className: string }> = {
  ELIGIBLE:                  { label: "ผ่านเกณฑ์",               className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" },
  ELIGIBLE_ADJUSTED:         { label: "ผ่าน + ปรับยอด",          className: "bg-teal-500/10 text-teal-600 border border-teal-500/30" },
  ELIGIBLE_BASE:             { label: "ผ่าน (ค่าฐาน)",           className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" },
  ELIGIBLE_BASE_ADJUSTED:    { label: "ผ่าน (ค่าฐาน+ปรับยอด)", className: "bg-teal-500/10 text-teal-600 border border-teal-500/30" },
  INELIGIBLE_NO_PV:          { label: "ไม่ผ่าน (ไม่มียอดขาย)",  className: "bg-red-500/10 text-red-500 border border-red-500/30" },
  INELIGIBLE_NOT_VERIFIED:          { label: "ไม่ผ่าน (ยังไม่ยืนยันตัวตน)",           className: "bg-orange-500/10 text-orange-600 border border-orange-500/30" },
  INELIGIBLE_NOT_VERIFIED_ADJUSTED: { label: "ไม่ผ่าน (ยังไม่ยืนยัน — ปรับยอดถูกระงับ)", className: "bg-orange-500/10 text-orange-600 border border-orange-500/30" },
  ADJUSTMENT_ONLY:                  { label: "ปรับยอดเท่านั้น",                          className: "bg-amber-500/10 text-amber-600 border border-amber-500/30" },
};

const TRANSFER_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NOT_SENT: {
    label: "ยังไม่ได้โอน",
    className: "bg-muted text-muted-foreground border border-border",
  },
  PENDING_TRANSFER: {
    label: "รอส่งโอน",
    className: "bg-amber-500/10 text-amber-600 border border-amber-500/30",
  },
  CREATED: {
    label: "สร้างรายการโอนแล้ว",
    className: "bg-blue-500/10 text-blue-600 border border-blue-500/30",
  },
  SENT_PENDING: {
    label: "ส่งรายการโอนแล้ว",
    className: "bg-blue-500/10 text-blue-600 border border-blue-500/30",
  },
  SENT: {
    label: "ส่งโอนแล้ว",
    className: "bg-blue-500/10 text-blue-600 border border-blue-500/30",
  },
  PAID: {
    label: "โอนสำเร็จ",
    className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30",
  },
  TRANSFER_FAILED: {
    label: "โอนไม่สำเร็จ",
    className: "bg-red-500/10 text-red-500 border border-red-500/30",
  },
  NO_TRANSFER_REQUIRED: {
    label: "ไม่ต้องโอน",
    className: "bg-muted text-muted-foreground border border-border",
  },
};

const DOCUMENT_STATUS_CONFIG: Record<string, string> = {
  ISSUED: "ออกเอกสารแล้ว",
};

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    icon: any;
  }
> = {
  DRAFT: {
    label: t("settlements.draft"),
    variant: "outline",
    icon: ClockIcon,
    className:
      "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
  SUBMITTED: {
    label: t("settlements.submitted"),
    variant: "outline",
    icon: ShieldCheck,
    className:
      "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10",
  },
  APPROVED: {
    label: t("settlements.approved"),
    variant: "outline",
    icon: CheckCircle2,
    className:
      "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  REJECTED: {
    label: t("settlements.rejected"),
    variant: "outline",
    icon: XCircle,
    className: "border-red-500/40 text-red-600 dark:text-red-400 bg-red-500/10",
  },
};

function getPreviousMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function isSettlementDay(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const nowUtc = new Date();
  const nowIct = new Date(nowUtc.getTime() + 7 * 60 * 60_000);
  return nowIct.getUTCDate() === 1;
}

export default function SettlementsPage() {
  const [period, setPeriod] = useState(getPreviousMonth);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [result, setResult] = useState<SettlementPreview | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [list, setList] = useState<SettlementPreview[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [userRole, setUserRole] = useState<string>("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // CSV viewer state
  const [linesOpen, setLinesOpen] = useState(false);
  const [linesData, setLinesData] = useState<LinesData | null>(null);
  const [linesLoadingId, setLinesLoadingId] = useState<string | null>(null);
  const [transferLoadingId, setTransferLoadingId] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    action: "submit" | "approve" | "reject";
  } | null>(null);

  useEffect(() => {
    setUserRole(getAdminRole());
  }, []);

  // Auto-dismiss success after 5s
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(t);
    }
  }, [success]);

  const loadSettlements = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await fetchWithAuth("/v1/settlements");
      setList(data.settlements || []);
    } catch (err) {
      console.error(err);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettlements();
  }, [loadSettlements]);

  const handlePreview = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    setResult(null);
    try {
      const data = await fetchWithAuth("/v1/settlements/preview", {
        method: "POST",
        body: JSON.stringify({ periodMonth: period }),
      });
      setResult(data.preview);
      loadSettlements();
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /** List item actions — covers submit (admin), approve/reject (finance checker) */
  const handleListAction = async (
    id: string,
    action: "submit" | "approve" | "reject",
  ) => {
    setActionLoadingId(id);
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth(`/v1/settlements/${id}/${action}`, { method: "POST" });
      const newStatus =
        action === "submit" ? "SUBMITTED" : action === "approve" ? "APPROVED" : "REJECTED";
      setSuccess(
        action === "submit"
          ? t("settlements.submitSuccess")
          : `${t("settlements.actionSuccessPrefix")} ${action === "approve" ? t("settlements.approveAction") : t("settlements.rejectAction")} ${t("settlements.successSuffix")}`,
      );
      loadSettlements();
      if (result?.snapshotId === id) {
        setResult({ ...result, status: newStatus });
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExport = async (id: string, periodMonth: string) => {
    setExportLoading(true);
    setSuccess("");
    setError("");
    try {
      const blob = await fetchBlobWithAuth(`/v1/settlements/${id}/export`);
      downloadBlob(blob, `settlement-${periodMonth}-${id.slice(0, 8)}.csv`);
      setSuccess(t("settlements.exportSuccess"));
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleViewLines = async (id: string) => {
    setSuccess("");
    setError("");
    setLinesLoadingId(id);
    try {
      const data = await fetchWithAuth(`/v1/settlements/${id}/lines`);
      setLinesData(data);
      setLinesOpen(true);
    } catch (err) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setLinesLoadingId(null);
    }
  };

  const handleRetryTransfer = async (row: PayoutLineRow) => {
    if (!linesData) return;
    setTransferLoadingId(row.payoutLineId);
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth(
        `/v1/settlements/${linesData.snapshotId}/lines/${row.payoutLineId}/transfer`,
        { method: "POST" },
      );
      setSuccess(t("settlements.transferSuccess"));
      await handleViewLines(linesData.snapshotId);
      await loadSettlements();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTransferLoadingId(null);
    }
  };

  const handleExportCsv = () => {
    if (!result?.snapshotId) return;
    handleExport(result.snapshotId, result.periodMonth);
  };

  const statusConfig = result
    ? (STATUS_CONFIG[result.status] ?? STATUS_CONFIG.DRAFT)
    : null;

  const isFinanceChecker = userRole === "FINANCE_CHECKER";
  const canPreview = isSettlementDay();

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tight text-foreground">{t("settlements.title")}</h2>
        <p className="text-muted-foreground font-medium">{t("settlements.description")}</p>
      </div>

      {/* Cron Job Info */}
      <Card className="overflow-hidden border-none shadow-sm rounded-2xl bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
              <ClockIcon className="h-5 w-5" />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="text-sm font-bold text-foreground">{t("settlements.cronInfoTitle")}</h3>
              <p className="text-xs text-muted-foreground font-medium">{t("settlements.cronInfoDescription")}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  {t("settlements.cronInfoDetail1")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  {t("settlements.cronInfoDetail2")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  {t("settlements.cronInfoDetail3")}
                </span>
              </div>
              <p className="text-[10px] font-mono text-indigo-600/60 dark:text-indigo-400/60 bg-indigo-500/5 px-2 py-1 rounded-lg w-fit">
                {t("settlements.cronInfoSchedule")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FINANCE_CHECKER notice — รอ Admin submit ก่อน */}
      {isFinanceChecker && !listLoading && (
        list.some((r) => r.status === "SUBMITTED") ? (
          <Alert className="rounded-2xl border-2 border-blue-500/30 bg-blue-500/5 shadow-md">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <AlertTitle className="font-bold text-blue-700 dark:text-blue-400">
              มีรายการรออนุมัติจาก Admin
            </AlertTitle>
            <AlertDescription className="font-medium text-blue-700/80 dark:text-blue-400/80">
              ตรวจสอบรายละเอียดในรายการด้านล่าง แล้วกด &quot;อนุมัติ & โอนเงิน&quot; เพื่อดำเนินการ
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 shadow-md">
            <Info className="h-5 w-5 text-amber-600" />
            <AlertTitle className="font-bold text-amber-700 dark:text-amber-400">
              {t("settlements.checkerWaitTitle")}
            </AlertTitle>
            <AlertDescription className="font-medium text-amber-700/80 dark:text-amber-400/80">
              รอ Admin คำนวณและส่งรายการเพื่อตรวจสอบ
            </AlertDescription>
          </Alert>
        )
      )}

      {/* Run Preview Card */}
      {userRole !== "FINANCE_CHECKER" && (
        <Card className="overflow-hidden border-none shadow-lg rounded-3xl bg-gradient-to-br from-brand-500/10 to-brand-600/5">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-500 rounded-2xl text-white shadow-md">
                <PlayCircle className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{t("settlements.calculatePeriod")}</CardTitle>
                <CardDescription className="font-medium">
                  {t("settlements.manualPreviewNote")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end bg-card p-6 rounded-2xl border border-brand-100/50 shadow-sm">
              <div className="space-y-2 w-full sm:w-auto flex-1">
                <Label htmlFor="period" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">{t("settlements.periodLabel")}</Label>
                <Input
                  id="period"
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="h-12 rounded-xl border-2 focus-visible:ring-brand-500"
                />
              </div>
              <Button
                onClick={handlePreview}
                disabled={loading || !canPreview}
                className="h-12 px-8 rounded-xl font-bold shadow-lg shadow-brand-500/20 w-full sm:w-auto"
              >
                {loading ? (
                  <RefreshCw className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ReceiptText className="h-5 w-5 mr-2" />
                    {t("settlements.createPreview")}
                  </>
                )}
              </Button>
            </div>
            {!canPreview && (
              <p className="mt-3 text-xs font-medium text-amber-600 flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5" />
                สร้างรายการได้เฉพาะวันที่ 1 ของเดือน (หลัง CronJob สร้าง DRAFT อัตโนมัติ)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {(error || success) && (
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive" className="rounded-2xl border-2 shadow-md relative">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="font-bold">{t("settlements.errorTitle")}</AlertTitle>
              <AlertDescription className="font-medium">{error}</AlertDescription>
              <button onClick={() => setError("")} className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-colors" aria-label="ปิดการแจ้งเตือน">
                <X className="h-4 w-4" />
              </button>
            </Alert>
          )}
          {success && (
            <Alert className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 shadow-md relative">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <AlertTitle className="font-bold text-emerald-700">{t("settlements.successTitle")}</AlertTitle>
              <AlertDescription className="font-medium text-emerald-700/80">{success}</AlertDescription>
              <button onClick={() => setSuccess("")} className="absolute top-3 right-3 text-emerald-400 hover:text-emerald-600 transition-colors" aria-label="ปิดการแจ้งเตือน">
                <X className="h-4 w-4" />
              </button>
            </Alert>
          )}
        </div>
      )}

      {/* Settlement Preview Result */}
      {result && (
        <Card className="overflow-hidden border-none shadow-2xl rounded-3xl bg-card animate-in zoom-in-95 duration-300">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 px-8 py-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-xl text-brand-600 dark:text-brand-400">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">{t("settlements.calculationResult")}</CardTitle>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase tracking-tighter">
                  ID: {result.snapshotId}
                </div>
              </div>
            </div>
            {statusConfig && (
              <Badge
                variant={statusConfig.variant}
                className={`rounded-full px-4 py-1.5 font-bold shadow-sm ${statusConfig.className}`}
              >
                <statusConfig.icon className="h-4 w-4 mr-1.5" />
                {statusConfig.label}
              </Badge>
            )}
          </CardHeader>

          <CardContent className="px-8 py-12">
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="text-center space-y-2">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">ยอดสุทธิรวม (หลังหักภาษี ณ ที่จ่าย)</p>
                <p className="text-6xl font-black text-foreground tabular-nums tracking-tighter">
                  {((result.totalNetPayoutSatang ?? 0) / 100).toLocaleString(
                    "th-TH",
                    {
                      style: "currency",
                      currency: "THB",
                    },
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  ก่อนหักภาษี{" "}
                  <span className="font-semibold">
                    {((result.totalPayoutSatang ?? 0) / 100).toLocaleString("th-TH", { style: "currency", currency: "THB" })}
                  </span>
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-8 w-full max-w-md pt-8 border-t border-dashed">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("settlements.period")}</p>
                  <p className="text-lg font-bold text-foreground">{result.periodMonth}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("settlements.payeeCount")}</p>
                  <p className="text-lg font-bold text-foreground">{result.payoutLineCount || "0"} {t("settlements.personUnit")}</p>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="bg-muted/10 px-8 py-6 border-t">
            <div className="flex items-start gap-3 max-w-sm">
              <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                {t("settlements.securityNotice")}
              </p>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* History List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-foreground">{t("settlements.history")}</h3>
            <Badge variant="secondary" className="rounded-full font-bold">{list.length}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadSettlements}
            disabled={listLoading}
            className="rounded-full hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 dark:hover:text-brand-400"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${listLoading ? "animate-spin" : ""}`} />
            {t("settlements.refresh")}
          </Button>
        </div>

        {listLoading && list.length === 0 && (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden animate-pulse">
                <div className="h-1 w-full bg-muted" />
                <div className="grid gap-0 xl:grid-cols-[1fr_340px]">
                  <div className="flex min-w-0 items-center gap-4 p-5">
                    <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <div className="border-t border-border/70 bg-muted/15 p-5 xl:border-l xl:border-t-0 space-y-3">
                    <Skeleton className="h-8 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {list.length === 0 && !listLoading && (
          <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
            <ReceiptText className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="font-bold text-muted-foreground">{t("settlements.emptyHistory")}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {list.map((run) => {
            const sc = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.DRAFT;
            const isItemDraft = run.status === "DRAFT";
            const isItemSubmitted = run.status === "SUBMITTED";

            return (
              <Card
                key={run.snapshotId}
                className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all hover:border-brand-500/30 hover:shadow-md"
              >
                <CardContent className="p-0">
                  <div className={`h-1 w-full ${isItemDraft ? "bg-amber-500" : isItemSubmitted ? "bg-blue-500" : "bg-brand-500"}`} />
                  <div className="grid gap-0 xl:grid-cols-[1fr_340px]">
                    <div className="flex min-w-0 items-center gap-4 p-5">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isItemDraft ? 'bg-amber-500/10 dark:bg-amber-900/20 text-amber-600' : isItemSubmitted ? 'bg-blue-500/10 dark:bg-blue-900/20 text-blue-600' : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'}`}>
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg">{run.periodMonth}</p>
                          <Badge
                            variant={sc.variant}
                            className={`rounded-full px-3 text-[10px] font-bold ${sc.className}`}
                          >
                            {sc.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                           <p className="text-xs font-medium text-muted-foreground">
                            {t("settlements.createdAtPrefix")} <span className="font-bold text-foreground">{new Date(run.createdAt || "").toLocaleDateString("th-TH")}</span>
                          </p>
                          <p className="text-xs font-medium text-muted-foreground">
                            {t("settlements.itemPrefix")} <span className="font-bold text-foreground">{run.payoutLineCount || 0}</span>
                          </p>
                        </div>
                      </div>
                      <div className="ml-auto hidden min-w-[150px] rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-right sm:block">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Net payout
                        </p>
                        <p className="mt-1 text-base font-black tabular-nums text-foreground">
                          {((run.totalNetPayoutSatang ?? 0) / 100).toLocaleString("th-TH", {
                            style: "currency",
                            currency: "THB",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-border/70 bg-muted/15 p-5 xl:border-l xl:border-t-0">
                      <CopyableId name="Snapshot ID" id={run.snapshotId} />
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {/* ดูรายการในหน้าเว็บ */}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={linesLoadingId === run.snapshotId}
                          onClick={() => handleViewLines(run.snapshotId)}
                          className="col-span-2 h-10 w-full rounded-xl font-bold hover:bg-background"
                        >
                          {linesLoadingId === run.snapshotId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              ดูรายการ
                            </>
                          )}
                        </Button>
                        {run.status === "APPROVED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={exportLoading}
                            onClick={() => handleExport(run.snapshotId, run.periodMonth)}
                            className="col-span-2 h-10 w-full rounded-xl font-bold hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            CSV
                          </Button>
                        )}
                        {/* Admin: ส่งรออนุมัติ (DRAFT เท่านั้น) */}
                        {isItemDraft && !isFinanceChecker && (
                          <Button
                            size="sm"
                            disabled={actionLoadingId === run.snapshotId}
                            onClick={() => setConfirmAction({ id: run.snapshotId, action: "submit" })}
                            className="col-span-2 h-10 w-full rounded-xl bg-blue-600 font-bold shadow-md shadow-blue-500/10 hover:bg-blue-700"
                          >
                            {actionLoadingId === run.snapshotId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : "ส่งรออนุมัติ"}
                          </Button>
                        )}
                        {/* Finance Checker: อนุมัติ + ปฏิเสธ (SUBMITTED เท่านั้น) */}
                        {isItemSubmitted && isFinanceChecker && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionLoadingId === run.snapshotId}
                              onClick={() => setConfirmAction({ id: run.snapshotId, action: "reject" })}
                              className="h-10 w-full rounded-xl font-bold border-red-200 text-red-600 hover:bg-red-50"
                            >
                              {t("settlements.rejectAction")}
                            </Button>
                            <Button
                                size="sm"
                                disabled={
                                  actionLoadingId === run.snapshotId ||
                                  (run.pendingAdjustmentCount ?? 0) > 0
                                }
                                onClick={() => setConfirmAction({ id: run.snapshotId, action: "approve" })}
                                className="h-10 w-full rounded-xl font-bold bg-brand-600 shadow-md shadow-brand-500/10"
                              >
                                {actionLoadingId === run.snapshotId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : t("settlements.approveAction")}
                              </Button>
                              {(run.pendingAdjustmentCount ?? 0) > 0 && (
                                <span className="col-span-full rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-600">
                                  มีปรับยอดค้าง {run.pendingAdjustmentCount} รายการ
                                </span>
                              )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payout Lines Viewer — bottom sheet */}
      <Sheet open={linesOpen} onOpenChange={setLinesOpen}>
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

                              if (!canRetryTransfer) {
                                return row.transferBlockedReason ? (
                                  <span className="text-[10px] font-medium text-amber-500">
                                    {row.transferBlockedReason}
                                  </span>
                                ) : null;
                              }

                              return (
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

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={
          confirmAction?.action === "submit"
            ? t("settlements.confirmSubmitTitle")
            : confirmAction?.action === "approve"
              ? t("settlements.confirmApproveTitle")
              : t("settlements.confirmRejectTitle")
        }
        description={
          confirmAction?.action === "submit"
            ? t("settlements.confirmSubmitDescription")
            : confirmAction?.action === "approve"
              ? t("settlements.confirmApproveDescription")
              : t("settlements.confirmRejectDescription")
        }
        variant={confirmAction?.action === "reject" ? "destructive" : "default"}
        confirmLabel={
          confirmAction?.action === "submit"
            ? "ส่งรออนุมัติ"
            : confirmAction?.action === "approve"
              ? t("settlements.approveAction")
              : t("settlements.rejectAction")
        }
        onConfirm={async () => {
          if (confirmAction) {
            await handleListAction(confirmAction.id, confirmAction.action);
          }
        }}
        icon={
          confirmAction?.action === "reject"
            ? <XCircle className="h-5 w-5 text-red-500" />
            : <ShieldCheck className="h-5 w-5 text-brand-600" />
        }
      />
    </div>
  );
}
