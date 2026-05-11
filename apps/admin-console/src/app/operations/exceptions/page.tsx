"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      params.set("status", "UNRESOLVED");
      const resp = await fetchWithAuth(
        `/v1/operations/exceptions?${params.toString()}`,
      );
      setData(resp.exceptions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load exceptions");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalAmount = useMemo(() => data.length, [data]);

  const handleResolve = async (id: string, action: string) => {
    setResolvingId(id);
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth(
        `/v1/operations/exceptions/${id}/${action.replace(/\s+/g, "_").toUpperCase()}`,
        { method: "POST" },
      );
      setSuccess(`Exception ${id} was updated.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update exception");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Operations exceptions
          </h2>
          <p className="text-sm text-muted-foreground">
            Unresolved operational events from persisted finance exception records.
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Operation failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700">
            {success}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Unresolved queue
            <Badge variant="secondary">{totalAmount}</Badge>
          </CardTitle>
          <CardDescription>
            Review failed webhooks, payment/enrollment mismatches, and manual
            recovery cases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") loadData();
              }}
              placeholder="Search exception, student, class..."
              className="pl-8"
            />
          </div>

          {loading && <Skeleton className="h-28 w-full" />}
          {!loading && data.length === 0 && (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No unresolved exceptions match this filter.
            </div>
          )}

          <div className="space-y-3">
            {data.map((item) => (
              <div key={item.id} className="rounded-md border p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-red-500/40 bg-red-500/10 text-red-600"
                      >
                        {item.type}
                      </Badge>
                      <Badge variant="secondary">{item.status}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.id}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Student</p>
                        <p className="font-medium">{item.studentName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Class</p>
                        <p className="font-mono">{item.classId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Provider</p>
                        <p>{item.provider}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="font-medium">{item.amount}</p>
                      </div>
                    </div>
                    <p className="rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
                      {item.errorDetail || "No error detail"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("th-TH")}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 lg:w-48">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resolvingId === item.id}
                      onClick={() => handleResolve(item.id, "Void Cancel")}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Void / cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={resolvingId === item.id}
                      onClick={() => handleResolve(item.id, "Force Active")}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Force active
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
