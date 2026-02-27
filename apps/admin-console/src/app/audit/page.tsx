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
} from "lucide-react";

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
    label: "สร้าง Preview",
    icon: PlayCircle,
    className:
      "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10",
  },
  APPROVE: {
    label: "อนุมัติ Settlement",
    icon: CheckCircle2,
    className:
      "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  REJECT: {
    label: "ปฏิเสธ Settlement",
    icon: XCircle,
    className: "border-red-500/40 text-red-600 dark:text-red-400 bg-red-500/10",
  },
  ADJUST_CREATE: {
    label: "สร้าง Adjustment",
    icon: FilePenLine,
    className:
      "border-violet-500/40 text-violet-600 dark:text-violet-400 bg-violet-500/10",
  },
  ADJUST_APPROVE: {
    label: "อนุมัติ Adjustment",
    icon: CheckCircle2,
    className:
      "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  ADJUST_REJECT: {
    label: "ปฏิเสธ Adjustment",
    icon: XCircle,
    className: "border-red-500/40 text-red-600 dark:text-red-400 bg-red-500/10",
  },
  EXPORT: {
    label: "Export CSV",
    icon: Download,
    className:
      "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
};

const ALL_ACTIONS = "ALL";

// ── CopyableId Component ────────────────────────────────────────────────────
function CopyableId({ name, id }: { name: string; id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const truncated = id.length > 20 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;

  return (
    <div>
      <p className="font-medium text-foreground text-xs">{name}</p>
      <div className="flex items-center gap-1 mt-0.5">
        <p className="font-mono text-[10px] text-muted-foreground">
          {truncated}
        </p>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground transition-colors"
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

  const handleFilterChange = (setter: any) => (val: any) => {
    setter(val);
    setPage(1);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <div className="space-y-6 w-full">
      {/* Header & Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Audit Trail — ประวัติการทำงานแบบ Immutable
          </CardTitle>
          <CardDescription>
            บันทึกทุกการกระทำที่เกี่ยวกับ Settlement และ Payout
            ไม่สามารถแก้ไขย้อนหลังได้
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="space-y-1.5 w-full sm:w-48">
              <Label htmlFor="filterPeriod">รอบบิล</Label>
              <Input
                id="filterPeriod"
                type="month"
                value={filterPeriod}
                onChange={(e) =>
                  handleFilterChange(setFilterPeriod)(e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-56">
              <Label>ประเภทการกระทำ</Label>
              <Select
                value={filterAction}
                onValueChange={handleFilterChange(setFilterAction)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="ทั้งหมด" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ACTIONS}>ทั้งหมด</SelectItem>
                  <SelectItem value="PREVIEW">สร้าง Preview</SelectItem>
                  <SelectItem value="APPROVE">อนุมัติ Settlement</SelectItem>
                  <SelectItem value="REJECT">ปฏิเสธ Settlement</SelectItem>
                  <SelectItem value="ADJUST_CREATE">
                    สร้าง Adjustment
                  </SelectItem>
                  <SelectItem value="ADJUST_APPROVE">
                    อนุมัติ Adjustment
                  </SelectItem>
                  <SelectItem value="ADJUST_REJECT">
                    ปฏิเสธ Adjustment
                  </SelectItem>
                  <SelectItem value="EXPORT">Export CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={loadLogs}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              รีเฟรช
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Empty */}
      {!loading && logs.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Eye className="h-8 w-8 opacity-20" />
            <p>ไม่พบบันทึกในรอบบิลและตัวกรองที่เลือก</p>
          </CardContent>
        </Card>
      )}

      {/* Log Timeline */}
      <div className="space-y-3">
        {logs.map((log, index) => {
          const config = ACTION_CONFIG[log.actionType];
          const Icon = config?.icon ?? Eye;
          return (
            <div key={log.auditId} className="flex gap-3">
              {/* Timeline Connector */}
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted border border-border shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                {index < logs.length - 1 && (
                  <div className="w-px flex-1 bg-border mt-1 min-h-4" />
                )}
              </div>

              {/* Log Card */}
              <Card className="flex-1 mb-3">
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={config?.className ?? ""}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {config?.label ?? log.actionType}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDate(log.createdAt)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">ทำโดย</p>
                      <CopyableId
                        name={log.displayName ?? log.actorUserId}
                        id={log.actorUserId}
                      />
                    </div>
                    <div>
                      <p className="text-muted-foreground">รอบบิล</p>
                      <p className="font-medium">{log.periodMonth || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Target ID</p>
                      <CopyableId name={log.actionType} id={log.targetId} />
                    </div>
                  </div>

                  {(log.previousStatus || log.newStatus) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {log.previousStatus && (
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                          {log.previousStatus}
                        </span>
                      )}
                      {log.previousStatus && log.newStatus && <span>→</span>}
                      {log.newStatus && (
                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                          {log.newStatus}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ก่อนหน้า
          </Button>
          <span className="text-sm text-muted-foreground">
            หน้า {page} จาก {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            ถัดไป
          </Button>
        </div>
      )}
    </div>
  );
}
