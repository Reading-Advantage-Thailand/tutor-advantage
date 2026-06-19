"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Zap,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAuth } from "@/lib/api";
import { t } from "@/lib/i18n";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface FraudFlag {
  id: string;
  type: string;
  severity: string;
  targetId: string;
  targetName: string;
  description: string;
  status: string;
  createdAt: string;
}

interface FraudStats {
  activeCount: number;
  velocityStatus: string;
  autoSuspensions: number;
}

export default function FraudFlagsPage() {
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [stats, setStats] = useState<FraudStats>({
    activeCount: 0,
    velocityStatus: "-",
    autoSuspensions: 0,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [confirmFreeze, setConfirmFreeze] = useState<{ id: string; targetName: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      const resp = await fetchWithAuth(`/v1/fraud-flags?${params.toString()}`);
      setFlags(resp.flags ?? []);
      setStats(
        resp.stats ?? {
          activeCount: 0,
          velocityStatus: "-",
          autoSuspensions: 0,
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load flags");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeFlags = useMemo(
    () => flags.filter((flag) => flag.status !== "CLEARED"),
    [flags],
  );

  const handleAction = async (id: string, actionName: string) => {
    setLoadingAction(id + actionName);
    try {
      await fetchWithAuth(`/v1/fraud-flags/${id}/action`, {
        method: "POST",
        body: JSON.stringify({ action: actionName }),
      });
      toast.success(t("fraud.actionSuccess"));
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update flag");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">{t("fraud.title")}</h2>
          <p className="text-muted-foreground font-medium">{t("fraud.description")}</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading} className="rounded-full font-bold shadow-sm h-12 px-6">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("fraud.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card className="border-none shadow-sm rounded-3xl bg-amber-500/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="h-24 w-24 text-amber-600" />
          </div>
          <CardContent className="p-8 relative z-10">
            <p className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">
              <AlertTriangle className="h-4 w-4" />
              {t("fraud.activeAlerts")}
            </p>
            <p className="mt-4 text-5xl font-black text-amber-900 dark:text-amber-50">{stats.activeCount}</p>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm rounded-3xl bg-blue-500/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity className="h-24 w-24 text-blue-600" />
          </div>
          <CardContent className="p-8 relative z-10">
            <p className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">
              <Activity className="h-4 w-4" />
              {t("fraud.velocityStatus")}
            </p>
            <p className="mt-4 text-5xl font-black text-blue-900 dark:text-blue-50">{stats.velocityStatus}</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl bg-red-500/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Lock className="h-24 w-24 text-red-600" />
          </div>
          <CardContent className="p-8 relative z-10">
            <p className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-widest">
              <Lock className="h-4 w-4" />
              {t("fraud.suspendedAccounts")}
            </p>
            <p className="mt-4 text-5xl font-black text-red-900 dark:text-red-50">{stats.autoSuspensions}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md rounded-3xl bg-card overflow-hidden">
        <CardHeader className="bg-muted/20 border-b px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">{t("fraud.reviewQueue")}</CardTitle>
              <CardDescription className="font-medium text-xs">{t("fraud.reviewQueueDescription")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-brand-600 transition-colors" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") loadData();
              }}
              placeholder={t("fraud.searchPlaceholder")}
              className="pl-11 h-12 rounded-2xl border-2 focus-visible:ring-brand-500 font-medium bg-muted/30"
            />
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
          ) : (
            <>
          {activeFlags.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
              <ShieldCheck className="h-12 w-12 text-emerald-500/50 mb-4" />
              <p className="font-bold text-muted-foreground">{t("fraud.safeTitle")}</p>
              <p className="text-sm text-muted-foreground/60 mt-1">{t("fraud.safeDescription")}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {activeFlags.map((flag) => (
              <div key={flag.id} className="rounded-2xl border border-border/60 bg-card p-6 transition-all hover:shadow-md hover:border-red-500/30 group">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`font-bold px-3 py-1 uppercase tracking-wider text-[10px] rounded-full border-none ${
                          flag.severity === "HIGH" || flag.severity === "CRITICAL"
                            ? "bg-red-500/10 text-red-700 dark:text-red-400"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {flag.severity}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px] px-2 py-1 rounded-md bg-muted/50 border-border/50">
                        {flag.type}
                      </Badge>
                      <Badge variant="secondary" className="px-2 py-1 rounded-md text-[10px] font-bold">
                        {flag.status}
                      </Badge>
                      <span className="text-xs font-medium text-muted-foreground ml-auto">
                        {new Date(flag.createdAt).toLocaleString("th-TH")}
                      </span>
                    </div>
                    
                    <div>
                      <p className="text-lg font-bold text-foreground">
                        {flag.targetName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground bg-muted w-fit px-2 py-0.5 rounded mt-1">
                        {flag.targetId}
                      </p>
                    </div>
                    
                    <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                      <p className="text-sm font-medium text-foreground">
                        {flag.description || t("fraud.noDescription")}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-full md:w-48 border-t md:border-t-0 md:border-l border-border/50 pt-4 md:pt-0 md:pl-6">
                    <Button
                      className="w-full rounded-xl font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40 border-none shadow-sm"
                      disabled={loadingAction !== null}
                      onClick={() => handleAction(flag.id, "CLEAR")}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {t("fraud.clear")}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl font-bold border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400 dark:hover:bg-blue-950/30"
                      disabled={loadingAction !== null}
                      onClick={() => handleAction(flag.id, "MONITOR")}
                    >
                      <Activity className="mr-2 h-4 w-4" />
                      {t("fraud.monitor")}
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full rounded-xl font-bold border-none shadow-sm"
                      disabled={loadingAction !== null}
                      onClick={() => setConfirmFreeze({ id: flag.id, targetName: flag.targetName })}
                    >
                      <Lock className="mr-2 h-4 w-4" />
                      {t("fraud.freeze")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
            </>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={!!confirmFreeze}
        onOpenChange={(open) => { if (!open) setConfirmFreeze(null); }}
        title={t("fraud.confirmFreezeTitle")}
        description={`${t("fraud.confirmFreezeDescription")} (${confirmFreeze?.targetName ?? ""})`}
        variant="destructive"
        confirmLabel={t("fraud.freeze")}
        cancelLabel={t("confirm.cancelLabel")}
        onConfirm={async () => {
          if (confirmFreeze) await handleAction(confirmFreeze.id, "FREEZE");
        }}
      />
    </div>
  );
}
