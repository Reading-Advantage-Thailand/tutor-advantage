"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchWithAuth } from "../../lib/api";
import { CopyableId } from "@/components/ui/copyable-id";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Ticket,
  Clock,
  Copy,
  Check,
  Ban,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/lib/i18n";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Coupon {
  couponId: string;
  code: string;
  hours: number;
  status: "ACTIVE" | "REDEEMED" | "VOID" | "EXPIRED";
  note: string | null;
  assignedTutorId: string | null;
  assignedTutorName: string | null;
  redeemedByTutorId: string | null;
  redeemedByTutorName: string | null;
  redemptionMode: string | null;
  redeemedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<Coupon["status"], string> = {
  ACTIVE:
    "border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
  REDEEMED:
    "border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30",
  VOID:
    "border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30",
  EXPIRED:
    "border-muted text-muted-foreground bg-muted/40",
};

function statusLabel(status: Coupon["status"]): string {
  switch (status) {
    case "ACTIVE":
      return t("coupons.statusActive");
    case "REDEEMED":
      return t("coupons.statusRedeemed");
    case "VOID":
      return t("coupons.statusVoid");
    case "EXPIRED":
      return t("coupons.statusExpired");
  }
}

export default function CouponsPage() {
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [assignedTutorId, setAssignedTutorId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const [list, setList] = useState<Coupon[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (submitSuccess) {
      const timer = setTimeout(() => setSubmitSuccess(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [submitSuccess]);

  const loadCoupons = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: "50" });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const data = await fetchWithAuth(`/v1/coupons?${params.toString()}`);
      setList(data.coupons ?? []);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (err) {
      setListError((err as Error).message);
    } finally {
      setListLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const hoursValue = parseInt(hours, 10);
    if (isNaN(hoursValue) || hoursValue <= 0) {
      setSubmitError(t("coupons.validation.hoursRequired"));
      return;
    }
    setSubmitLoading(true);
    setSubmitError("");
    setSubmitSuccess("");
    try {
      const body: Record<string, unknown> = { hours: hoursValue };
      if (note.trim()) body.note = note.trim();
      if (assignedTutorId.trim()) body.assignedTutorId = assignedTutorId.trim();
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      const data = await fetchWithAuth("/v1/coupons", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSubmitSuccess(`${t("coupons.issueSuccess")}: ${data.coupon?.code ?? ""}`);
      setHours("");
      setNote("");
      setAssignedTutorId("");
      setExpiresAt("");
      setPage(1);
      loadCoupons();
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleVoid = async (couponId: string) => {
    setActionLoadingId(couponId);
    setListError("");
    try {
      await fetchWithAuth(`/v1/coupons/${couponId}/void`, { method: "POST" });
      loadCoupons();
    } catch (err) {
      setListError((err as Error).message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("th-TH") : "—";

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tight text-foreground">{t("coupons.title")}</h2>
        <p className="text-muted-foreground font-medium">{t("coupons.description")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Issue Form */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-lg rounded-3xl overflow-hidden bg-card">
            <CardHeader className="bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-brand-900/20 dark:to-brand-800/10 pb-6 border-b border-brand-100 dark:border-brand-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-500 rounded-xl text-white shadow-sm">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">{t("coupons.issueTitle")}</CardTitle>
                  <CardDescription className="font-medium text-brand-700/80 dark:text-brand-400/80">
                    {t("coupons.issueDescription")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="hours" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("coupons.hours")}</Label>
                  <Input
                    id="hours"
                    type="number"
                    min="1"
                    placeholder={t("coupons.hoursPlaceholder")}
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    required
                    className="rounded-xl border-2 focus-visible:ring-brand-500 h-12"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="note" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("coupons.note")}</Label>
                  <Textarea
                    id="note"
                    placeholder={t("coupons.notePlaceholder")}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="rounded-xl border-2 focus-visible:ring-brand-500 resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="assignedTutorId" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("coupons.assignedTutor")}</Label>
                  <Input
                    id="assignedTutorId"
                    placeholder={t("coupons.assignedTutorPlaceholder")}
                    value={assignedTutorId}
                    onChange={(e) => setAssignedTutorId(e.target.value)}
                    className="rounded-xl border-2 focus-visible:ring-brand-500 h-12"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expiresAt" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("coupons.expiresAt")}</Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="rounded-xl border-2 focus-visible:ring-brand-500 h-12"
                  />
                </div>

                {submitError && (
                  <Alert variant="destructive" className="rounded-xl border-2 relative">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-bold">{t("coupons.errorTitle")}</AlertTitle>
                    <AlertDescription className="font-medium">{submitError}</AlertDescription>
                    <button onClick={() => setSubmitError("")} className="absolute top-2.5 right-2.5 text-red-400 hover:text-red-600 transition-colors" aria-label="ปิด">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Alert>
                )}
                {submitSuccess && (
                  <Alert className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 relative">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <AlertDescription className="font-medium text-emerald-700 dark:text-emerald-400">
                      {submitSuccess}
                    </AlertDescription>
                    <button onClick={() => setSubmitSuccess("")} className="absolute top-2.5 right-2.5 text-emerald-400 hover:text-emerald-600 transition-colors" aria-label="ปิด">
                      <X className="h-3.5 w-3.5" />
                    </button>
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
                      {t("coupons.issuing")}
                    </span>
                  ) : (
                    <>
                      <Ticket className="h-5 w-5 mr-2" />
                      {t("coupons.issue")}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Coupon List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
            <div>
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Ticket className="h-5 w-5 text-brand-500" />
                {t("coupons.listTitle")}
              </h3>
              <p className="text-sm font-medium text-muted-foreground mt-1">
                {t("coupons.listDescription")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px] rounded-full font-bold h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("coupons.allStatus")}</SelectItem>
                  <SelectItem value="ACTIVE">{t("coupons.statusActive")}</SelectItem>
                  <SelectItem value="REDEEMED">{t("coupons.statusRedeemed")}</SelectItem>
                  <SelectItem value="VOID">{t("coupons.statusVoid")}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadCoupons}
                disabled={listLoading}
                className="rounded-full font-bold shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${listLoading ? "animate-spin" : ""}`} />
                {t("coupons.refresh")}
              </Button>
            </div>
          </div>

          {listError && (
            <Alert variant="destructive" className="rounded-2xl border-2 shadow-sm relative">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription className="font-medium">{listError}</AlertDescription>
              <button onClick={() => setListError("")} className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-colors" aria-label="ปิด">
                <X className="h-4 w-4" />
              </button>
            </Alert>
          )}

          {!listLoading && list.length === 0 && !listError && (
            <Card className="border-none shadow-sm rounded-3xl bg-muted/20 border-2 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <Ticket className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="font-bold text-muted-foreground">{t("coupons.emptyTitle")}</p>
                <p className="text-sm text-muted-foreground/60 mt-1">{t("coupons.emptyDescription")}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4">
            {list.map((c) => (
              <Card key={c.couponId} className="group overflow-hidden border-none shadow-sm rounded-3xl transition-all hover:shadow-md bg-card ring-1 ring-border">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-black text-lg tracking-wider text-foreground bg-muted/50 px-3 py-1 rounded-xl">
                            {c.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => copyCode(c.code, c.couponId)}
                            title={t("coupons.copyCode")}
                          >
                            {copiedId === c.couponId ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                        <Badge variant="outline" className={`rounded-full px-3 py-0.5 font-bold uppercase tracking-wider ${STATUS_STYLES[c.status]}`}>
                          {statusLabel(c.status)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-brand-50/50 dark:bg-brand-950/20 p-3 rounded-2xl border border-brand-100 dark:border-brand-900">
                          <p className="text-[10px] font-bold text-brand-700 dark:text-brand-400 uppercase tracking-widest mb-1">{t("coupons.hours")}</p>
                          <p className="font-black text-lg text-brand-700 dark:text-brand-400 tabular-nums">{c.hours} {t("coupons.hoursUnit")}</p>
                        </div>
                        <div className="bg-muted/30 p-3 rounded-2xl border border-border/50">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><Clock className="h-3 w-3" />{t("coupons.expires")}</p>
                          <p className="font-bold text-foreground">{formatDate(c.expiresAt)}</p>
                        </div>
                      </div>

                      {c.note && (
                        <p className="text-sm font-medium text-foreground bg-muted/30 p-3 rounded-2xl border border-border/50">{c.note}</p>
                      )}
                    </div>

                    <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-border/50 pt-4 md:pt-0 md:pl-6 min-w-[220px] gap-4">
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("coupons.assignedTo")}</p>
                          {c.assignedTutorId ? (
                            <CopyableId name={c.assignedTutorName ?? "—"} id={c.assignedTutorId} variant="name" />
                          ) : (
                            <p className="text-sm font-medium text-muted-foreground">{t("coupons.anyTutor")}</p>
                          )}
                        </div>
                        {c.redeemedByTutorId && (
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("coupons.redeemedBy")}</p>
                            <CopyableId name={c.redeemedByTutorName ?? "—"} id={c.redeemedByTutorId} variant="name" />
                            <p className="text-xs text-muted-foreground mt-1">{t("coupons.redeemedAt")}: {formatDate(c.redeemedAt)}</p>
                          </div>
                        )}
                      </div>

                      {c.status === "ACTIVE" && (
                        <Button
                          variant="outline"
                          disabled={actionLoadingId === c.couponId}
                          onClick={() => setVoidId(c.couponId)}
                          className="w-full rounded-xl font-bold border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-700 h-10"
                        >
                          {actionLoadingId === c.couponId ? (
                            <span className="w-4 h-4 border-2 border-red-300/40 border-t-red-500 rounded-full animate-spin" />
                          ) : (
                            <>
                              <Ban className="h-4 w-4 mr-2" />
                              {t("coupons.void")}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                className="rounded-xl font-bold"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("coupons.previous")}
              </Button>
              <span className="text-sm font-bold text-muted-foreground bg-muted/50 px-4 py-2 rounded-xl">
                {t("coupons.pagePrefix")} {page} {t("coupons.pageMiddle")} {totalPages}
              </span>
              <Button
                variant="outline"
                className="rounded-xl font-bold"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t("coupons.next")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!voidId}
        onOpenChange={(open) => { if (!open) setVoidId(null); }}
        title={t("coupons.confirmVoidTitle")}
        description={t("coupons.confirmVoidDescription")}
        variant="destructive"
        confirmLabel={t("coupons.void")}
        cancelLabel={t("confirm.cancelLabel")}
        onConfirm={async () => {
          if (voidId) await handleVoid(voidId);
        }}
      />
    </div>
  );
}
