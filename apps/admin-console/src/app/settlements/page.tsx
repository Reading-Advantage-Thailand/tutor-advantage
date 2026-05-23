"use client";

import { useState, useEffect, useCallback } from "react";
import { downloadBlob, fetchBlobWithAuth, fetchWithAuth } from "../../lib/api";
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
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { t } from "@/lib/i18n";

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

function CopyableId({ name, id }: { name: string; id: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const truncated =
    id.length > 20 ? `${id.slice(0, 8)}\u2026${id.slice(-4)}` : id;
  return (
    <div>
      {name && <p className="font-bold text-foreground text-[10px] uppercase tracking-wider mb-1 opacity-60">{name}</p>}
      <div className="flex items-center gap-2 bg-muted/50 px-2 py-1 rounded-md border border-border/50">
        <p className="font-mono text-[10px] text-muted-foreground">
          {truncated}
        </p>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-brand-600 transition-colors"
          title={t("settlements.copyId")}
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
    </div>
  );
}

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

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )admin_role=([^;]*)/);
    if (match) setUserRole(decodeURIComponent(match[1]));
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

  const handleApprove = async () => {
    if (!result?.snapshotId) return;
    setLoading(true);
    setError("");
    try {
      await fetchWithAuth(`/v1/settlements/${result.snapshotId}/approve`, {
        method: "POST",
      });
      setSuccess(t("settlements.approveSuccess"));
      setResult({ ...result, status: "APPROVED" });
      loadSettlements();
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
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
      const err = error as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleListAction = async (id: string, action: "approve" | "reject") => {
    setActionLoadingId(id);
    try {
      await fetchWithAuth(`/v1/settlements/${id}/${action}`, {
        method: "POST",
      });
      setSuccess(
        `${t("settlements.actionSuccessPrefix")} ${action === "approve" ? t("settlements.approveAction") : t("settlements.rejectAction")} ${t("settlements.successSuffix")}`,
      );
      loadSettlements();
      if (result?.snapshotId === id) {
        setResult({
          ...result,
          status: action === "approve" ? "APPROVED" : "REJECTED",
        });
      }
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleListExport = async (id: string, periodMonth: string) => {
    setExportLoading(true);
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

  const handleExportCsv = async () => {
    if (!result?.snapshotId) return;
    setExportLoading(true);
    setError("");
    try {
      const blob = await fetchBlobWithAuth(
        `/v1/settlements/${result.snapshotId}/export`,
      );
      downloadBlob(
        blob,
        `settlement-${result.periodMonth}-${result.snapshotId.slice(0, 8)}.csv`,
      );
      setSuccess(t("settlements.exportSuccess"));
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const statusConfig = result
    ? (STATUS_CONFIG[result.status] ?? STATUS_CONFIG.DRAFT)
    : null;

  const isDraft = result?.status === "DRAFT";
  const isApproved = result?.status === "APPROVED";
  const isRejected = result?.status === "REJECTED";

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tight text-foreground">{t("settlements.title")}</h2>
        <p className="text-muted-foreground font-medium">{t("settlements.description")}</p>
      </div>

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
               {/* Reject Button */}
               <Button
                onClick={handleReject}
                disabled={loading || !isDraft}
                variant="outline"
                className="flex-1 md:flex-none h-12 rounded-xl font-bold border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700"
              >
                <XCircle className="h-5 w-5 mr-2" />
                {t("settlements.rejectAction")}
              </Button>
              {/* Approve Button */}
              <Button
                onClick={handleApprove}
                disabled={loading || !isDraft}
                className={`flex-1 md:flex-none h-12 px-8 rounded-xl font-bold shadow-lg transition-all ${isDraft ? 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20' : ''}`}
              >
                {isApproved ? (
                   <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    {t("settlements.approved")}
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-5 w-5 mr-2" />
                    {t("settlements.approveAndTransfer")}
                  </>
                )}
              </Button>
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

            return (
              <Card
                key={run.snapshotId}
                className={`group overflow-hidden border-none shadow-sm rounded-2xl transition-all hover:shadow-md hover:ring-1 hover:ring-brand-500/20 ${isItemDraft ? "bg-amber-50/20 dark:bg-amber-900/10" : "bg-card"}`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${isItemDraft ? 'bg-amber-500/10 dark:bg-amber-900/20 text-amber-600' : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'}`}>
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
                         {run.status === "APPROVED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={exportLoading}
                            onClick={() => handleListExport(run.snapshotId, run.periodMonth)}
                            className="h-10 rounded-xl font-bold hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            CSV
                          </Button>
                        )}
                        {isItemDraft && (
                          <Button
                            size="sm"
                            disabled={actionLoadingId === run.snapshotId}
                            onClick={() => handleListAction(run.snapshotId, "approve")}
                            className="h-10 px-4 rounded-xl font-bold bg-brand-600 shadow-md shadow-brand-500/10"
                          >
                            {t("settlements.approveAction")}
                          </Button>
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
    </div>
  );
}
