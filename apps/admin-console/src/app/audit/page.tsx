"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchWithAuth } from "../../lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  PlayCircle,
  FilePenLine,
  Download,
  Eye,
  Copy,
  Check,
  Clock,
  ArrowRight
} from "lucide-react";
import { t } from "@/lib/i18n";

interface AuditLog {
  auditId: string;
  actionType:
    | "PREVIEW"
    | "APPROVE"
    | "REJECT"
    | "ADJUST_CREATE"
    | "ADJUST_APPROVE"
    | "ADJUST_REJECT"
    | "EXPORT";
  actorUserId: string;
  displayName: string;
  targetId: string;
  periodMonth: string;
  previousStatus?: string;
  newStatus?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

const ACTION_CONFIG: Record<
  AuditLog["actionType"],
  {
    label: string;
    icon: React.ElementType;
    className: string;
  }
> = {
  PREVIEW: {
    label: "Preview Generated",
    icon: PlayCircle,
    className:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-none",
  },
  APPROVE: {
    label: "Settlement Approved",
    icon: CheckCircle2,
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-none",
  },
  REJECT: {
    label: "Settlement Rejected",
    icon: XCircle,
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-none",
  },
  ADJUST_CREATE: {
    label: "Adjustment Created",
    icon: FilePenLine,
    className:
      "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-none",
  },
  ADJUST_APPROVE: {
    label: "Adjustment Approved",
    icon: CheckCircle2,
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-none",
  },
  ADJUST_REJECT: {
    label: "Adjustment Rejected",
    icon: XCircle,
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-none",
  },
  EXPORT: {
    label: "Export CSV",
    icon: Download,
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-none",
  },
};

const ALL_ACTIONS = "ALL";

function CopyableId({ name, id }: { name: string; id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const truncated = id.length > 20 ? `${id.slice(0, 8)}\u2026${id.slice(-4)}` : id;

  return (
    <div>
      <p className="font-bold text-foreground text-xs">{name}</p>
      <div className="flex items-center gap-1 mt-0.5 bg-muted/50 px-2 py-0.5 rounded border border-border/50 w-fit">
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

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterPeriod, setFilterPeriod] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [filterAction, setFilterAction] = useState<string>(ALL_ACTIONS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterPeriod) params.set("periodMonth", filterPeriod);
      if (filterAction !== ALL_ACTIONS) params.set("actionType", filterAction);
      params.set("page", page.toString());
      params.set("pageSize", "50");

      const data = await fetchWithAuth(`/v1/audit-logs?${params.toString()}`);
      setLogs(data.logs ?? []);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (err) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterPeriod, filterAction, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleFilterChange =
    (setter: (val: string) => void) => (val: string) => {
      setter(val);
      setPage(1);
    };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return {
      time: d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
      date: d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
    };
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tight text-foreground">{t("audit.title")}</h2>
        <p className="text-muted-foreground font-medium">{t("audit.description")}</p>
      </div>

      {/* Header & Filters */}
      <Card className="border-none shadow-sm rounded-3xl bg-card overflow-hidden">
        <CardHeader className="bg-muted/20 border-b px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 dark:bg-brand-900/20 rounded-xl text-brand-600 dark:text-brand-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">{t("audit.searchTitle")}</CardTitle>
              <CardDescription className="font-medium text-xs">
                {t("audit.searchDescription")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="space-y-1.5 w-full sm:w-48">
              <Label htmlFor="filterPeriod" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("audit.period")}</Label>
              <Input
                id="filterPeriod"
                type="month"
                value={filterPeriod}
                onChange={(e) =>
                  handleFilterChange(setFilterPeriod)(e.target.value)
                }
                className="h-12 rounded-xl border-2 focus-visible:ring-brand-500"
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-64">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("audit.actionType")}</Label>
              <Select
                value={filterAction}
                onValueChange={handleFilterChange(setFilterAction)}
              >
                <SelectTrigger className="h-12 rounded-xl border-2 focus-visible:ring-brand-500">
                  <SelectValue placeholder={t("audit.allActions")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50">
                  <SelectItem value={ALL_ACTIONS}>{t("audit.allActions")}</SelectItem>
                  <SelectItem value="PREVIEW">{t("audit.preview")}</SelectItem>
                  <SelectItem value="APPROVE">{t("audit.approve")}</SelectItem>
                  <SelectItem value="REJECT">{t("audit.reject")}</SelectItem>
                  <SelectItem value="ADJUST_CREATE">{t("audit.adjustCreate")}</SelectItem>
                  <SelectItem value="ADJUST_APPROVE">{t("audit.adjustApprove")}</SelectItem>
                  <SelectItem value="ADJUST_REJECT">{t("audit.adjustReject")}</SelectItem>
                  <SelectItem value="EXPORT">{t("audit.export")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={loadLogs}
              disabled={loading}
              className="w-full sm:w-auto h-12 px-8 rounded-xl font-bold hover:bg-brand-50 hover:text-brand-600 transition-colors"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              {t("audit.filter")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive" className="rounded-2xl border-2 shadow-sm">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Empty */}
      {!loading && logs.length === 0 && !error && (
        <Card className="border-none shadow-sm rounded-3xl bg-muted/20 border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="font-bold text-muted-foreground">{t("audit.emptyTitle")}</p>
            <p className="text-sm text-muted-foreground/60 mt-1">{t("audit.emptyDescription")}</p>
          </CardContent>
        </Card>
      )}

      {/* Log Timeline */}
      <div className="relative pl-6 sm:pl-10 pb-8">
        {logs.length > 0 && (
          <div className="absolute top-0 bottom-0 left-9 sm:left-[3.25rem] w-px bg-border/80" />
        )}
        <div className="space-y-8">
          {logs.map((log) => {
            const config = ACTION_CONFIG[log.actionType];
            const Icon = config?.icon ?? Eye;
            const dateStr = formatDate(log.createdAt);
            return (
              <div key={log.auditId} className="relative group">
                {/* Timeline Node */}
                <div className="absolute -left-9 sm:-left-10 mt-1.5 flex items-center justify-center w-8 h-8 rounded-full bg-card border-2 border-border shadow-sm z-10 group-hover:border-brand-500 group-hover:text-brand-500 transition-colors">
                  <Icon className="h-4 w-4" />
                </div>

                {/* Log Card */}
                <Card className="ml-4 border-none shadow-sm rounded-2xl bg-card overflow-hidden ring-1 ring-border/50 hover:ring-brand-500/20 hover:shadow-md transition-all">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between p-5 gap-4">
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`px-3 py-1 font-bold text-[10px] uppercase tracking-wider rounded-full ${config?.className ?? ""}`}
                          >
                            {config?.label ?? log.actionType}
                          </Badge>
                          {log.periodMonth && (
                            <Badge variant="secondary" className="px-2 py-1 font-bold text-[10px] rounded-md bg-muted/50 border-none">
                              {t("audit.periodPrefix")} {log.periodMonth}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("audit.actor")}</p>
                            <CopyableId
                              name={log.displayName ?? log.actorUserId}
                              id={log.actorUserId}
                            />
                          </div>
                          <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t("audit.targetEntity")}</p>
                            <CopyableId name={log.actionType} id={log.targetId} />
                          </div>
                        </div>

                        {(log.previousStatus || log.newStatus) && (
                          <div className="flex items-center gap-3 pt-2">
                            {log.previousStatus && (
                              <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">{t("audit.before")}</span>
                                <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-1 rounded-md border border-border/50">
                                  {log.previousStatus}
                                </span>
                              </div>
                            )}
                            {log.previousStatus && log.newStatus && <ArrowRight className="h-4 w-4 text-muted-foreground mt-4" />}
                            {log.newStatus && (
                              <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">{t("audit.after")}</span>
                                <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-1 rounded-md border border-border/50">
                                  {log.newStatus}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-start sm:items-end gap-1 border-t sm:border-t-0 pt-4 sm:pt-0 sm:pl-4">
                        <span className="text-xl font-black text-foreground tabular-nums tracking-tighter">
                          {dateStr.time}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                          {dateStr.date}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 pb-8">
          <Button
            variant="outline"
            className="rounded-xl font-bold"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("audit.previous")}
          </Button>
          <span className="text-sm font-bold text-muted-foreground bg-muted/50 px-4 py-2 rounded-xl">
            {t("audit.pagePrefix")} {page} {t("audit.pageMiddle")} {totalPages}
          </span>
          <Button
            variant="outline"
            className="rounded-xl font-bold"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t("audit.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
