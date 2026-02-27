"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchWithAuth } from "../../lib/api";
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
} from "lucide-react";

export interface SettlementPreview {
  snapshotId: string;
  periodMonth: string;
  totalPayoutSatang?: number; // มีแค่ตอน preview / approve
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
  }
> = {
  DRAFT: {
    label: "Draft — รออนุมัติ",
    variant: "outline",
    className:
      "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
  APPROVED: {
    label: "อนุมัติแล้ว",
    variant: "outline",
    className:
      "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  REJECTED: {
    label: "ปฏิเสธแล้ว",
    variant: "outline",
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
    const token = localStorage.getItem("admin_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUserRole(payload.role);
      } catch (e) {
        // ignore
      }
    }
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
      setSuccess("Settlement อนุมัติสำเร็จ และปล่อย Payout Batch แล้ว");
      setResult({ ...result, status: "APPROVED" });
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
      setSuccess("Settlement ถูกปฏิเสธแล้ว กรุณาแก้ไขและรันใหม่อีกครั้ง");
      setResult({ ...result, status: "REJECTED" });
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleListAction = async (id: string, action: "approve" | "reject") => {
    setLoading(true);
    try {
      await fetchWithAuth(`/v1/settlements/${id}/${action}`, {
        method: "POST",
      });
      setSuccess(
        `Settlement ${action === "approve" ? "อนุมัติ" : "ปฏิเสธ"} สำเร็จ`,
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
      setLoading(false);
    }
  };

  const handleListExport = async (id: string, periodMonth: string) => {
    setExportLoading(true);
    try {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("admin_token")
          : null;
      const response = await fetch(
        `http://localhost:3003/v1/settlements/${id}/export`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error("ไม่สามารถส่งออกไฟล์ CSV ได้");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `settlement-${periodMonth}-${id.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess("ส่งออกไฟล์ CSV สำเร็จ");
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
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("admin_token")
          : null;
      const response = await fetch(
        `http://localhost:3003/v1/settlements/${result.snapshotId}/export`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error("ไม่สามารถส่งออกไฟล์ CSV ได้");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `settlement-${result.periodMonth}-${result.snapshotId.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess("ส่งออกไฟล์ CSV สำเร็จ");
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
    <div className="space-y-6 w-full">
      {/* Run Preview Card (Hide for Checker) */}
      {userRole !== "FINANCE_CHECKER" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlayCircle className="h-4 w-4 text-primary" />
              คำนวณรอบบิลและรายได้ (Settlement)
            </CardTitle>
            <CardDescription>
              จำลองและคำนวณยอดเงินที่จะต้องจ่ายให้ติวเตอร์ตามสายงาน
              การอนุมัติเพื่อจ่ายเงินจริงจะต้องใช้ระบบ Maker-Checker เสมอ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="space-y-1.5 w-full sm:w-auto">
                <Label htmlFor="period">รอบบิล (เดือน)</Label>
                <Input
                  id="period"
                  type="month"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full sm:w-48"
                />
              </div>
              <Button
                onClick={handlePreview}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    กำลังประมวลผล…
                  </span>
                ) : (
                  <>
                    <ReceiptText className="h-4 w-4 mr-2" />
                    สร้าง Preview
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>เกิดข้อผิดพลาด</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success */}
      {success && (
        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-emerald-700 dark:text-emerald-300">
            สำเร็จ
          </AlertTitle>
          <AlertDescription className="text-emerald-700/80 dark:text-emerald-400/80">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* Settlement Preview Result */}
      {result && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Settlement Snapshot
              </CardTitle>
              <CardDescription className="mt-1 font-mono text-xs">
                {result.snapshotId}
              </CardDescription>
            </div>
            {statusConfig && (
              <Badge
                variant={statusConfig.variant}
                className={statusConfig.className}
              >
                {isApproved && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {isRejected && <XCircle className="h-3 w-3 mr-1" />}
                {isDraft && <ClockIcon className="h-3 w-3 mr-1" />}
                {statusConfig.label}
              </Badge>
            )}
          </CardHeader>

          <CardContent>
            <Separator className="mb-6" />
            <div className="flex flex-col items-center justify-center py-6 gap-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                ยอดจ่ายรวม
              </p>
              <p className="text-5xl font-bold text-foreground tabular-nums">
                {((result.totalPayoutSatang ?? 0) / 100).toLocaleString(
                  "th-TH",
                  {
                    style: "currency",
                    currency: "THB",
                  },
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                รอบบิล:{" "}
                <span className="font-medium text-foreground">
                  {result.periodMonth}
                </span>
              </p>
            </div>
            <Separator className="mt-6" />
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between pt-4">
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
              เพื่อความปลอดภัย การอนุมัติสั่งจ่ายเงินจะต้องใช้แอดมินอีกคนเสมอ
              (ระบบ Maker-Checker) หลังจากที่อนุมัติแล้ว
              ข้อมูลการจ่ายเงินจะไม่สามารถเปลี่ยนแปลงได้อีก
            </p>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {/* Export CSV — แสดงเมื่อ Approved */}
              {isApproved && (
                <Button
                  onClick={handleExportCsv}
                  disabled={exportLoading}
                  variant="outline"
                  className="w-full sm:w-auto shrink-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                >
                  {exportLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                      กำลังส่งออก…
                    </span>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </>
                  )}
                </Button>
              )}
              {/* Reject Button */}
              <Button
                onClick={handleReject}
                disabled={loading || !isDraft}
                variant="outline"
                className="w-full sm:w-auto shrink-0 border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-40"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {isRejected ? "ปฏิเสธแล้ว" : "ปฏิเสธ"}
              </Button>
              {/* Approve Button */}
              <Button
                onClick={handleApprove}
                disabled={loading || !isDraft}
                variant={isDraft ? "default" : "outline"}
                className="w-full sm:w-auto shrink-0"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {isApproved ? "อนุมัติแล้ว" : "อนุมัติ & ปล่อยเงิน"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* History List */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          ประวัติการคำนวณรอบบิล (Settlements History)
          <Button
            variant="ghost"
            size="sm"
            onClick={loadSettlements}
            disabled={listLoading}
            className="ml-auto"
          >
            <RefreshCw
              className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </h3>

        {list.length === 0 && !listLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              ไม่มีประวัติ Settlement
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4">
          {list.map((run) => {
            const sc = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.DRAFT;
            const isItemApproved = run.status === "APPROVED";
            const isItemRejected = run.status === "REJECTED";
            const isItemDraft = run.status === "DRAFT";

            return (
              <Card
                key={run.snapshotId}
                className={isItemDraft ? "border-amber-500/20" : ""}
              >
                <CardHeader className="pb-3 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">รอบบิล</p>
                      <p className="font-medium">{run.periodMonth}</p>
                    </div>
                    <Badge
                      variant={sc.variant}
                      className={`w-fit mt-1 sm:mt-0 ${sc.className}`}
                    >
                      {isItemApproved && (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      )}
                      {isItemRejected && <XCircle className="h-3 w-3 mr-1" />}
                      {isItemDraft && <ClockIcon className="h-3 w-3 mr-1" />}
                      {sc.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        รายการจ่าย
                      </p>
                      <p className="font-medium text-foreground">
                        {run.payoutLineCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Snapshot ID
                      </p>
                      <CopyableId name="" id={run.snapshotId} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        สร้างเมื่อ
                      </p>
                      <p className="text-foreground text-sm font-mono">
                        {new Date(run.createdAt || "").toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {(isItemApproved || isItemDraft) && <Separator />}

                  <div className="flex gap-2 justify-end">
                    {isItemApproved && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={exportLoading}
                        onClick={() =>
                          handleListExport(run.snapshotId, run.periodMonth)
                        }
                        className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </Button>
                    )}
                    {isItemDraft && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionLoadingId === run.snapshotId}
                          onClick={() =>
                            handleListAction(run.snapshotId, "reject")
                          }
                          className="border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                        >
                          ปฏิเสธ
                        </Button>
                        <Button
                          size="sm"
                          disabled={actionLoadingId === run.snapshotId}
                          onClick={() =>
                            handleListAction(run.snapshotId, "approve")
                          }
                        >
                          {actionLoadingId === run.snapshotId ? (
                            <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                          )}
                          อนุมัติ
                        </Button>
                      </>
                    )}
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
