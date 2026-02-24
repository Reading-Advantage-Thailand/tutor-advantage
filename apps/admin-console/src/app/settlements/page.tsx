"use client";

import { useState } from "react";
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
} from "lucide-react";

export interface SettlementPreview {
  snapshotId: string;
  periodMonth: string;
  totalPayoutSatang: number;
  status: string;
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
    label: "Draft — Pending Approval",
    variant: "outline",
    className:
      "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
  APPROVED: {
    label: "Approved",
    variant: "outline",
    className:
      "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
};

export default function SettlementsPage() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SettlementPreview | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      setSuccess("Settlement approved and payout batch released.");
      setResult({ ...result, status: "APPROVED" });
    } catch (error) {
      const err = error as Error;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = result
    ? (STATUS_CONFIG[result.status] ?? STATUS_CONFIG.DRAFT)
    : null;

  return (
    <div className="space-y-6 w-full">
      {/* Run Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlayCircle className="h-4 w-4 text-primary" />
            Run Monthly Settlement
          </CardTitle>
          <CardDescription>
            Preview and approve payouts for tutors based on their MLM tree
            volume. Requires Makers-Checkers approval before release.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="space-y-1.5 w-full sm:w-auto">
              <Label htmlFor="period">Settlement Period</Label>
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
                  Processing…
                </span>
              ) : (
                <>
                  <ReceiptText className="h-4 w-4 mr-2" />
                  Generate Preview
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success */}
      {success && (
        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-emerald-700 dark:text-emerald-300">
            Success
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
                {result.status === "APPROVED" ? (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                ) : (
                  <ClockIcon className="h-3 w-3 mr-1" />
                )}
                {statusConfig.label}
              </Badge>
            )}
          </CardHeader>

          <CardContent>
            <Separator className="mb-6" />
            <div className="flex flex-col items-center justify-center py-6 gap-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Payout Volume
              </p>
              <p className="text-5xl font-bold text-foreground tabular-nums">
                {(result.totalPayoutSatang / 100).toLocaleString("th-TH", {
                  style: "currency",
                  currency: "THB",
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Period:{" "}
                <span className="font-medium text-foreground">
                  {result.periodMonth}
                </span>
              </p>
            </div>
            <Separator className="mt-6" />
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between pt-4">
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
              Approval requires a second authorised admin (Makers-Checkers).
              Once approved, the payout lineage is immutable and cannot be
              rewritten.
            </p>
            <Button
              onClick={handleApprove}
              disabled={loading || result.status !== "DRAFT"}
              variant={result.status === "APPROVED" ? "outline" : "default"}
              className="w-full sm:w-auto shrink-0"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {result.status === "APPROVED"
                ? "Already Approved"
                : "Approve & Release"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
