"use client";

import { useState } from "react";
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
  AlertCircle,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

// Mock Data removed, using API via fetchWithAuth
import { fetchWithAuth } from "@/lib/api";
import { useEffect, useCallback } from "react";

interface ExceptionEvent {
  id: string;
  type: string;
  studentName: string;
  classId: string;
  provider: string;
  amount: string;
  status: string;
  createdAt: string;
  errorDetail: string;
}

export default function ExceptionsPage() {
  const [data, setData] = useState<ExceptionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetchWithAuth("/v1/operations/exceptions");
      setData(resp.exceptions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRetry = async (id: string, action: string) => {
    setResolvingId(id);
    try {
      // In real scenario we wouldn't just pass action string directly like this in standard REST,
      // but matching the mock API signature.
      await fetchWithAuth(
        `/v1/operations/exceptions/${id}/${action.replace(/\s+/g, "_").toUpperCase()}`,
        {
          method: "POST",
        },
      );
      alert(`Action ${action} executed successfully for ${id}`);
    } catch (err) {
      console.error(err);
      alert(`Error applying action: ${err}`);
    } finally {
      setResolvingId(null);
    }
  };

  const handleRefresh = () => {
    loadData();
  };

  return (
    <div className="space-y-6 w-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Operations: Exceptions & Failed Events
          </CardTitle>
          <CardDescription>
            จัดการปัญหาคอขวด เช่น Webhook ไม่ทำงาน,
            จ่ายเงินสำเร็จแต่คลาสไม่เด้งให้เด็ก (Active Enrollment)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="ค้นหาด้วย Exception ID, ชื่อนักเรียน..."
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
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

      <Alert variant="default" className="bg-muted/50 border-muted">
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>ข้อควรระวัง</AlertTitle>
        <AlertDescription>
          การกด Force Active หรือ Manual Retry
          จะทำให้ออกใบเสร็จหรือบันทึกลงบัญชี กรุณาตรวจสอบสลิปใน Omise
          ประกอบการตัดสินใจทุกครั้ง
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {data.map((exc) => (
          <Card key={exc.id} className="border-amber-500/30 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="destructive"
                      className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                    >
                      {exc.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {exc.id}
                    </span>
                  </div>
                  <CardTitle className="text-sm mt-3">
                    {exc.studentName}
                  </CardTitle>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">เวลาเกิดเหตุ</p>
                  <p className="text-sm font-medium">
                    {new Date(exc.createdAt).toLocaleString("th-TH")}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Class ID</p>
                  <p className="font-mono mt-0.5">{exc.classId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Payment Provider
                  </p>
                  <p className="mt-0.5">{exc.provider}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ยอดเงิน</p>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {exc.amount}
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-md p-3 text-xs font-mono text-muted-foreground border">
                Exception details: {exc.errorDetail}
              </div>

              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resolvingId === exc.id}
                  onClick={() => handleRetry(exc.id, "Void")}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Void / Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={resolvingId === exc.id}
                  onClick={() => handleRetry(exc.id, "Force Active")}
                >
                  {resolvingId === exc.id ? (
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  )}
                  ตรวจสอบแล้ว Force Active
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function InfoIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
