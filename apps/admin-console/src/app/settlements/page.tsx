"use client";

import { useState, useEffect, useCallback } from "react";
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
  TrendingUp,
  FileText,
  Info,
  Eye,
  Loader2,
  UserCircle,
} from "lucide-react";

import { t } from "@/lib/i18n";

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
  grossPayoutTHB: number;
  badgeBonusTHB: number;
  whtTHB: number;
  netPayoutTHB: number;
  eligibilityStatus: string;
  documentNumber: string | null;
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
  totalPayoutSatang?: number; // Present only for preview / approve.
  status: string;
  createdBy?: string;
  createdAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  payoutLineCount?: number;
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
    label: "รออนุมัติ Finance",
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

export default function SettlementsPage() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
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

  useEffect(() => {
    setUserRole(getAdminRole());
  }, []);

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
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /** Admin: submit DRAFT → SUBMITTED (from result card) */
  const handleSubmitForReview = async () => {
    if (!result?.snapshotId) return;
    setLoading(true);
    setError("");
    try {
      await fetchWithAuth(`/v1/settlements/${result.snapshotId}/submit`, {
        method: "POST",
      });
      setSuccess("ส่งรออนุมัติ Finance Checker เรียบร้อยแล้ว");
      setResult({ ...result, status: "SUBMITTED" });
      loadSettlements();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  /** Admin: cancel own DRAFT (from result card) */
  const handleCancelDraft = async () => {
    if (!result?.snapshotId) return;
    setLoading(true);
    setError("");
    try {
      await fetchWithAuth(`/v1/settlements/${result.snapshotId}/reject`, {
        method: "POST",
      });
      setSuccess(t("settlements.rejectSuccess"));
      setResult({ ...result, status: "REJECTED" });
      loadSettlements();
    } catch (error) {
      setError((error as Error).message);
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
    try {
      await fetchWithAuth(`/v1/settlements/${id}/${action}`, { method: "POST" });
      const newStatus =
        action === "submit" ? "SUBMITTED" : action === "approve" ? "APPROVED" : "REJECTED";
      setSuccess(
        action === "submit"
          ? "ส่งรออนุมัติ Finance Checker เรียบร้อยแล้ว"
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

  const handleExportCsv = () => {
    if (!result?.snapshotId) return;
    handleExport(result.snapshotId, result.periodMonth);
  };

  const statusConfig = result
    ? (STATUS_CONFIG[result.status] ?? STATUS_CONFIG.DRAFT)
    : null;

  const isDraft = result?.status === "DRAFT";
  const isSubmitted = result?.status === "SUBMITTED";
  const isApproved = result?.status === "APPROVED";
  const isRejected = result?.status === "REJECTED";
  const isFinanceChecker = userRole === "FINANCE_CHECKER";

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tight text-foreground">{t("settlements.title")}</h2>
        <p className="text-muted-foreground font-medium">{t("settlements.description")}</p>
      </div>

      {/* FINANCE_CHECKER notice — รอ Admin submit ก่อน */}
      {isFinanceChecker && !listLoading && (
        list.some((r) => r.status === "SUBMITTED") ? (
          <Alert className="rounded-2xl border-2 border-blue-500/30 bg-blue-500/5 shadow-md">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <AlertTitle className="font-bold text-blue-700 dark:text-blue-400">
              มีรายการรออนุมัติจาก Admin
            </AlertTitle>
            <AlertDescription className="font-medium text-blue-700/80 dark:text-blue-400/80">
              ตรวจสอบรายละเอียดในรายการด้านล่าง แล้วกด "อนุมัติ & โอนเงิน" เพื่อดำเนินการ
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
                  {t("settlements.calculateDescription")}
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
                disabled={loading}
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
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {(error || success) && (
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive" className="rounded-2xl border-2 shadow-md">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="font-bold">{t("settlements.errorTitle")}</AlertTitle>
              <AlertDescription className="font-medium">{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 shadow-md">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <AlertTitle className="font-bold text-emerald-700">{t("settlements.successTitle")}</AlertTitle>
              <AlertDescription className="font-medium text-emerald-700/80">{success}</AlertDescription>
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
                <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">{t("settlements.totalPayout")}</p>
                <p className="text-6xl font-black text-foreground tabular-nums tracking-tighter">
                  {((result.totalPayoutSatang ?? 0) / 100).toLocaleString(
                    "th-TH",
                    {
                      style: "currency",
                      currency: "THB",
                    },
                  )}
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

          <CardFooter className="bg-muted/10 px-8 py-6 border-t flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-3 max-w-sm">
              <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                {t("settlements.securityNotice")}
              </p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* ADMIN: ยกเลิก DRAFT + ส่งรออนุมัติ */}
              {!isFinanceChecker && (
                <>
                  <Button
                    onClick={handleCancelDraft}
                    disabled={loading || !isDraft}
                    variant="outline"
                    className="flex-1 md:flex-none h-12 rounded-xl font-bold border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    ยกเลิก
                  </Button>
                  <Button
                    onClick={handleSubmitForReview}
                    disabled={loading || !isDraft}
                    className="flex-1 md:flex-none h-12 px-8 rounded-xl font-bold shadow-lg bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 disabled:opacity-50"
                  >
                    {isSubmitted ? (
                      <>
                        <ShieldCheck className="h-5 w-5 mr-2" />
                        ส่งแล้ว
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-5 w-5 mr-2" />
                        ส่งรออนุมัติ Finance
                      </>
                    )}
                  </Button>
                </>
              )}
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
                className={`group overflow-hidden border-none shadow-sm rounded-2xl transition-all hover:shadow-md hover:ring-1 hover:ring-brand-500/20 ${isItemDraft ? "bg-amber-50/20 dark:bg-amber-900/10" : isItemSubmitted ? "bg-blue-50/20 dark:bg-blue-900/10" : "bg-card"}`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${isItemDraft ? 'bg-amber-500/10 dark:bg-amber-900/20 text-amber-600' : isItemSubmitted ? 'bg-blue-500/10 dark:bg-blue-900/20 text-blue-600' : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'}`}>
                        <FileText className="h-6 w-6" />
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
                    </div>

                    <div className="flex items-center gap-6">
                      <CopyableId name="Snapshot ID" id={run.snapshotId} />
                      <div className="flex items-center gap-2">
                        {/* ดูรายการในหน้าเว็บ */}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={linesLoadingId === run.snapshotId}
                          onClick={() => handleViewLines(run.snapshotId)}
                          className="h-10 rounded-xl font-bold hover:bg-muted"
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
                            className="h-10 rounded-xl font-bold hover:bg-emerald-50 hover:text-emerald-600"
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
                            onClick={() => handleListAction(run.snapshotId, "submit")}
                            className="h-10 px-4 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/10"
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
                              onClick={() => handleListAction(run.snapshotId, "reject")}
                              className="h-10 rounded-xl font-bold border-red-200 text-red-600 hover:bg-red-50"
                            >
                              {t("settlements.rejectAction")}
                            </Button>
                            <Button
                              size="sm"
                              disabled={actionLoadingId === run.snapshotId}
                              onClick={() => handleListAction(run.snapshotId, "approve")}
                              className="h-10 px-4 rounded-xl font-bold bg-brand-600 shadow-md shadow-brand-500/10"
                            >
                              {actionLoadingId === run.snapshotId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : t("settlements.approveAction")}
                            </Button>
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
              {linesData && (
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
              <div className="rounded-2xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">รหัสครู</th>
                      <th className="px-4 py-3 text-right">ยอดขายรวม</th>
                      <th className="px-4 py-3 text-right">อัตราจ่าย</th>
                      <th className="px-4 py-3 text-right">ค่าตอบแทน</th>
                      <th className="px-4 py-3 text-right">โบนัส Badge</th>
                      <th className="px-4 py-3 text-right">ภาษีหัก ณ ที่จ่าย</th>
                      <th className="px-4 py-3 text-right font-black text-foreground">สุทธิ</th>
                      <th className="px-4 py-3 text-center">สถานะ</th>
                      <th className="px-4 py-3 text-left">เลขที่เอกสาร</th>
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
                          {row.grossPayoutTHB.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
                          {row.badgeBonusTHB > 0
                            ? `+${row.badgeBonusTHB.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                            : "—"}
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
                          {row.documentNumber ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t-2 border-border font-bold">
                    <tr>
                      <td className="px-4 py-3 text-xs uppercase tracking-wider" colSpan={6}>
                        รวมทั้งหมด ({linesData.lines.length} ราย)
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-brand-600">
                        {linesData.totalNetPayoutTHB.toLocaleString("th-TH", {
                          style: "currency",
                          currency: "THB",
                        })}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
