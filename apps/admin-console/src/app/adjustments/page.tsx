"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchWithAuth } from "../../lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  FilePenLine,
  RefreshCw,
  ShieldAlert,
  Copy,
  Check,
  Scale,
  PlusCircle,
  MinusCircle
} from "lucide-react";
import { t } from "@/lib/i18n";

interface Adjustment {
  adjustmentId: string;
  tutorUserId: string;
  tutorName: string;
  periodMonth: string;
  amountSatang: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
}

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
      <p className="font-bold text-foreground text-xs">{name}</p>
      <div className="flex items-center gap-1 mt-0.5 bg-muted/50 w-fit px-2 py-0.5 rounded-md border border-border/50">
        <p className="font-mono text-[10px] text-muted-foreground">
          {truncated}
        </p>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-brand-600 transition-colors"
          title="Copy full ID"
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

export default function AdjustmentsPage() {
  const [tutorUserId, setTutorUserId] = useState("");
  const [periodMonth, setPeriodMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [amountSatang, setAmountSatang] = useState("");
  const [reason, setReason] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const [pendingList, setPendingList] = useState<Adjustment[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserRole(payload.role);
      } catch (error) {
        console.error("Failed to parse token:", error);
      }
    }
  }, []);

  const loadPending = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const data = await fetchWithAuth(
        `/v1/adjustments?status=PENDING&page=${page}&pageSize=50`,
      );
      setPendingList(data.adjustments ?? []);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (err) {
      const error = err as Error;
      setListError(error.message);
    } finally {
      setListLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitError("");
    setSubmitSuccess("");
    try {
      await fetchWithAuth("/v1/adjustments", {
        method: "POST",
        body: JSON.stringify({
          tutorUserId,
          periodMonth,
          amountSatang: parseInt(amountSatang, 10),
          reason,
        }),
      });
      setSubmitSuccess(t("adjustments.submitSuccess"));
      setTutorUserId("");
      setAmountSatang("");
      setReason("");
      loadPending();
    } catch (err) {
      const error = err as Error;
      setSubmitError(error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setActionLoadingId(id);
    try {
      await fetchWithAuth(`/v1/adjustments/${id}/${action}`, {
        method: "POST",
      });
      loadPending();
    } catch (err) {
      const error = err as Error;
      setListError(error.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatTHB = (satang: number) =>
    (satang / 100).toLocaleString("th-TH", {
      style: "currency",
      currency: "THB",
    });

  const parsedAmount = parseInt(amountSatang, 10);
  const isPositive = !isNaN(parsedAmount) && parsedAmount >= 0;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tight text-foreground">{t("adjustments.title")}</h2>
        <p className="text-muted-foreground font-medium">{t("adjustments.description")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Maker Form */}
        <div className="lg:col-span-1 space-y-6">
          {userRole !== "FINANCE_CHECKER" && (
            <Card className="border-none shadow-lg rounded-3xl overflow-hidden bg-card">
              <CardHeader className="bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-brand-900/20 dark:to-brand-800/10 pb-6 border-b border-brand-100 dark:border-brand-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-500 rounded-xl text-white shadow-sm">
                    <Scale className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">{t("adjustments.addNew")}</CardTitle>
                    <CardDescription className="font-medium text-brand-700/80 dark:text-brand-400/80">
                      {t("adjustments.addDescription")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="tutorUserId" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("adjustments.tutorUserId")}</Label>
                    <Input
                      id="tutorUserId"
                      placeholder="usr_xxxxxxxxxxxxxxxx"
                      value={tutorUserId}
                      onChange={(e) => setTutorUserId(e.target.value)}
                      required
                      className="rounded-xl border-2 focus-visible:ring-brand-500 h-12"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="adjPeriod" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("adjustments.targetPeriod")}</Label>
                    <Input
                      id="adjPeriod"
                      type="month"
                      value={periodMonth}
                      onChange={(e) => setPeriodMonth(e.target.value)}
                      required
                      className="rounded-xl border-2 focus-visible:ring-brand-500 h-12"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="amountSatang" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("adjustments.amountSatang")}</Label>
                      {amountSatang && !isNaN(parsedAmount) && (
                        <Badge variant="outline" className={`font-bold border-none px-2 py-0.5 ${isPositive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                          {isPositive ? <PlusCircle className="h-3 w-3 mr-1" /> : <MinusCircle className="h-3 w-3 mr-1" />}
                          {formatTHB(Math.abs(parsedAmount))}
                        </Badge>
                      )}
                    </div>
                    <Input
                      id="amountSatang"
                      type="number"
                      placeholder={t("adjustments.amountPlaceholder")}
                      value={amountSatang}
                      onChange={(e) => setAmountSatang(e.target.value)}
                      required
                      className="rounded-xl border-2 focus-visible:ring-brand-500 h-12"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="reason" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("adjustments.reason")}</Label>
                    <Textarea
                      id="reason"
                      placeholder={t("adjustments.reasonPlaceholder")}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      required
                      rows={4}
                      className="rounded-xl border-2 focus-visible:ring-brand-500 resize-none"
                    />
                  </div>

                  {submitError && (
                    <Alert variant="destructive" className="rounded-xl border-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle className="font-bold">{t("adjustments.errorTitle")}</AlertTitle>
                      <AlertDescription className="font-medium">{submitError}</AlertDescription>
                    </Alert>
                  )}
                  {submitSuccess && (
                    <Alert className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <AlertDescription className="font-medium text-emerald-700 dark:text-emerald-400">
                        {submitSuccess}
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={submitLoading}
                    className="w-full h-12 rounded-xl font-bold bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20"
                  >
                    {submitLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t("adjustments.submitting")}
                      </span>
                    ) : (
                      <>
                        <FilePenLine className="h-5 w-5 mr-2" />
                        {t("adjustments.submit")}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {userRole === "FINANCE_CHECKER" && (
            <Card className="border-none shadow-sm rounded-3xl bg-muted/50">
              <CardContent className="p-8 text-center">
                <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2">{t("adjustments.checkerMode")}</h3>
                <p className="text-muted-foreground text-sm font-medium">
                  {t("adjustments.checkerDescription")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Checker Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
            <div>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                {t("adjustments.pendingApproval")}
              </h3>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                {t("adjustments.pendingDescription")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadPending}
              disabled={listLoading}
              className="rounded-full font-bold shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${listLoading ? "animate-spin" : ""}`} />
              {t("adjustments.refresh")}
            </Button>
          </div>

          {listError && (
            <Alert variant="destructive" className="rounded-2xl border-2 shadow-sm">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription className="font-medium">{listError}</AlertDescription>
            </Alert>
          )}

          {!listLoading && pendingList.length === 0 && !listError && (
            <Card className="border-none shadow-sm rounded-3xl bg-muted/20 border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <Scale className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="font-bold text-muted-foreground">{t("adjustments.emptyTitle")}</p>
                <p className="text-sm text-muted-foreground/60 mt-1">{t("adjustments.emptyDescription")}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4">
            {pendingList.map((adj) => (
              <Card key={adj.adjustmentId} className="group overflow-hidden border-none shadow-sm rounded-3xl transition-all hover:shadow-md bg-card ring-1 ring-border hover:ring-amber-500/30">
                <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-amber-600 opacity-80" />
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <CopyableId name={adj.tutorName} id={adj.tutorUserId} />
                        </div>
                        <Badge variant="outline" className="border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-full px-3 py-0.5 font-bold uppercase tracking-wider">
                          {t("adjustments.pending")}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/30 p-3 rounded-2xl border border-border/50">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("adjustments.period")}</p>
                          <p className="font-bold text-foreground">{adj.periodMonth}</p>
                        </div>
                        <div className={`p-3 rounded-2xl border ${adj.amountSatang >= 0 ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900" : "bg-red-50/50 border-red-100 dark:bg-red-950/20 dark:border-red-900"}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${adj.amountSatang >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{t("adjustments.amount")}</p>
                          <p className={`font-black text-lg tabular-nums ${adj.amountSatang >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
                            {formatTHB(Math.abs(adj.amountSatang))} {adj.amountSatang >= 0 ? t("adjustments.addAmount") : t("adjustments.deductAmount")}
                          </p>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("adjustments.reason")}</p>
                        <p className="text-sm font-medium text-foreground bg-muted/30 p-3 rounded-2xl border border-border/50">{adj.reason}</p>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-border/50 pt-4 md:pt-0 md:pl-6 min-w-[200px]">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("adjustments.requestor")}</p>
                        <CopyableId name={adj.createdByName} id={adj.createdByUserId} />
                      </div>
                      
                      <div className="flex flex-col gap-2 mt-4">
                        <Button
                          disabled={actionLoadingId === adj.adjustmentId}
                          onClick={() => handleAction(adj.adjustmentId, "approve")}
                          className="w-full rounded-xl font-bold bg-foreground text-background hover:bg-foreground/90 h-10"
                        >
                          {actionLoadingId === adj.adjustmentId ? (
                            <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                          )}
                          {t("adjustments.approve")}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={actionLoadingId === adj.adjustmentId}
                          onClick={() => handleAction(adj.adjustmentId, "reject")}
                          className="w-full rounded-xl font-bold border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700 h-10"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          {t("adjustments.reject")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                className="rounded-xl font-bold"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("adjustments.previous")}
              </Button>
              <span className="text-sm font-bold text-muted-foreground bg-muted/50 px-4 py-2 rounded-xl">
                {t("adjustments.pagePrefix")} {page} {t("adjustments.pageMiddle")} {totalPages}
              </span>
              <Button
                variant="outline"
                className="rounded-xl font-bold"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t("adjustments.next")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
