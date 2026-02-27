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
} from "lucide-react";

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
      setSubmitSuccess("ส่งคำขอปรับยอดเงินสำเร็จ รอ Checker อนุมัติ");
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

  return (
    <div className="space-y-6 w-full">
      {/* Maker Form (Hide for Checker) */}
      {userRole !== "FINANCE_CHECKER" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FilePenLine className="h-4 w-4 text-primary" />
              สร้างรายการปรับยอดเงิน (สำหรับ Maker)
            </CardTitle>
            <CardDescription>
              เพิ่มหรือลดยอดเงินของติวเตอร์ในระบบ
              โดยรายการทั้งหมดจะต้องได้รับการอนุมัติจากผู้ตรวจสอบ (Checker)
              อีกท่านก่อนจึงจะมีผล
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tutorUserId">Tutor User ID</Label>
                  <Input
                    id="tutorUserId"
                    placeholder="usr_xxxxxxxxxxxxxxxx"
                    value={tutorUserId}
                    onChange={(e) => setTutorUserId(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adjPeriod">รอบบิลที่มีผล</Label>
                  <Input
                    id="adjPeriod"
                    type="month"
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amountSatang">
                  จำนวนเงิน (สตางค์){" "}
                  <span className="text-muted-foreground text-xs">
                    ใส่ค่าบวกเพื่อเพิ่มเงิน หรือใส่ค่าลบเพื่อหักเงิน
                  </span>
                </Label>
                <Input
                  id="amountSatang"
                  type="number"
                  placeholder="เช่น 10000 = 100 บาท, -5000 = หัก 50 บาท"
                  value={amountSatang}
                  onChange={(e) => setAmountSatang(e.target.value)}
                  required
                />
                {amountSatang && !isNaN(parseInt(amountSatang, 10)) && (
                  <p className="text-xs text-muted-foreground">
                    ≈{" "}
                    <span
                      className={
                        parseInt(amountSatang, 10) >= 0
                          ? "text-emerald-600 dark:text-emerald-400 font-medium"
                          : "text-red-600 dark:text-red-400 font-medium"
                      }
                    >
                      {formatTHB(parseInt(amountSatang, 10))}
                    </span>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reason">เหตุผล (บังคับระบุ)</Label>
                <Textarea
                  id="reason"
                  placeholder="อธิบายเหตุผลในการปรับยอดให้ชัดเจน เช่น คืนเงินค่าธรรมเนียมผิดพลาด"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={3}
                />
              </div>

              {submitError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>เกิดข้อผิดพลาด</AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
              {submitSuccess && (
                <Alert className="border-emerald-500/30 bg-emerald-500/5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                    {submitSuccess}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={submitLoading}
                className="w-full sm:w-auto"
              >
                {submitLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    กำลังส่ง…
                  </span>
                ) : (
                  <>
                    <FilePenLine className="h-4 w-4 mr-2" />
                    ส่งคำขอปรับยอด
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {userRole === "FINANCE_CHECKER" && (
        <Alert variant="default" className="bg-muted/50 border-muted">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>สิทธิ์การเข้าถึง</AlertTitle>
          <AlertDescription>
            คุณมีสิทธิ์เป็น Checker เท่านั้น สามารถอนุมัติหรือปฏิเสธรายการได้
            แต่ไม่สามารถสร้างรายการใหม่ได้
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      {/* Checker Panel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              รายการที่รอการอนุมัติ (สำหรับ Checker)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              เพื่อความโปร่งใส
              คุณจะไม่สามารถอนุมัติรายการที่คุณเป็นผู้สร้างเองได้
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadPending}
            disabled={listLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${listLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {listError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{listError}</AlertDescription>
          </Alert>
        )}

        {!listLoading && pendingList.length === 0 && !listError && (
          <Card>
            <CardContent className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              ไม่มีรายการรออนุมัติในขณะนี้
            </CardContent>
          </Card>
        )}

        {pendingList.map((adj) => (
          <Card key={adj.adjustmentId} className="border-amber-500/20">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Tutor</p>
                  <CopyableId name={adj.tutorName} id={adj.tutorUserId} />
                </div>
                <Badge
                  variant="outline"
                  className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 w-fit"
                >
                  รออนุมัติ
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">รอบบิล</p>
                  <p className="font-medium">{adj.periodMonth}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">จำนวน</p>
                  <p
                    className={`font-bold ${adj.amountSatang >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {formatTHB(adj.amountSatang)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">สร้างโดย</p>
                  <CopyableId
                    name={adj.createdByName}
                    id={adj.createdByUserId}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">เหตุผล</p>
                <p className="text-sm mt-0.5 text-foreground">{adj.reason}</p>
              </div>
              <Separator />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionLoadingId === adj.adjustmentId}
                  onClick={() => handleAction(adj.adjustmentId, "reject")}
                  className="border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  ปฏิเสธ
                </Button>
                <Button
                  size="sm"
                  disabled={actionLoadingId === adj.adjustmentId}
                  onClick={() => handleAction(adj.adjustmentId, "approve")}
                >
                  {actionLoadingId === adj.adjustmentId ? (
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  )}
                  อนุมัติ
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 pb-6">
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
