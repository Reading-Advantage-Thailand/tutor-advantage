"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ShieldAlert,
  Search,
  AlertTriangle,
  Lock,
  CheckCircle2,
  XCircle,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { fetchWithAuth } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";

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
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const resp = await fetchWithAuth("/v1/fraud-flags");
      if (resp.flags) setFlags(resp.flags);
      if (resp.stats) setStats(resp.stats);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAction = async (id: string, actionName: string) => {
    setLoadingAction(id + actionName);
    try {
      await fetchWithAuth(`/v1/fraud-flags/${id}/action`, {
        method: "POST",
        body: JSON.stringify({ action: actionName }),
      });
      alert(`Applied action ${actionName} to flag ${id}`);
    } catch (err) {
      alert("Failed applying action");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <Card className="border-red-500/20 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
            <ShieldAlert className="h-5 w-5" />
            Fraud Prevention & Review Flags
          </CardTitle>
          <CardDescription>
            แจ้งเตือนความผิดปกติของปริมาณการสมัครเรียน (Velocity Checks)
            หรือพฤติกรรมเสี่ยง เพื่อป้องกันข้อผิดพลาดในการคำนวณ MLM Payout
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-muted/50 p-4 rounded-lg border">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Active
                Flags
              </p>
              <p className="text-3xl font-bold mt-2">{stats.activeCount}</p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg border">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" /> System Velocity
              </p>
              <p className="text-2xl sm:text-3xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">
                {stats.velocityStatus}
              </p>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg border">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-red-500" /> Auto-Suspensions
              </p>
              <p className="text-3xl font-bold mt-2">{stats.autoSuspensions}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="ค้นหาตาม Flag ID, Target ID..."
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-4">
            {flags.map((flag) => (
              <div
                key={flag.id}
                className="border rounded-lg p-4 md:p-5 hover:border-border/80 transition-colors bg-card"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="destructive"
                        className={
                          flag.severity === "HIGH"
                            ? "bg-red-500/10 text-red-600 border-red-500/20"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        }
                      >
                        {flag.severity}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px]"
                      >
                        {flag.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto md:ml-2">
                        {new Date(flag.createdAt).toLocaleString("th-TH")}
                      </span>
                    </div>

                    <div className="pt-2">
                      <p className="font-semibold text-sm">
                        Target: {flag.targetName}{" "}
                        <span className="font-mono text-muted-foreground text-xs ml-1">
                          ({flag.targetId})
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {flag.description}
                      </p>
                    </div>
                  </div>

                  <div className="md:border-l md:pl-5 flex flex-col gap-2 min-w-[200px]">
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                      Investigation Action
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full justify-start text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10"
                      disabled={loadingAction !== null}
                      onClick={() => handleAction(flag.id, "CLEAR")}
                    >
                      {loadingAction === flag.id + "CLEAR" ? (
                        <span className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                      )}
                      Clear (Safe)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full justify-start text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
                      disabled={loadingAction !== null}
                      onClick={() => handleAction(flag.id, "MONITOR")}
                    >
                      <Activity className="h-3.5 w-3.5 mr-2" /> Mark as
                      Monitoring
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full justify-start"
                      disabled={loadingAction !== null}
                      onClick={() => handleAction(flag.id, "FREEZE")}
                    >
                      {loadingAction === flag.id + "FREEZE" ? (
                        <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 mr-2" />
                      )}
                      Freeze Account
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
