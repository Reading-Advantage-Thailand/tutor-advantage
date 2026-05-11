"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChartNoAxesColumn,
  ExternalLink,
  Link as LinkIcon,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAuth } from "@/lib/api";

interface UnresolvedLink {
  url: string;
  hits: number;
  lastSeen: string;
}

interface Mapping {
  id: string;
  source: string;
  target: string;
  created: string;
}

export default function LegacyLinksPage() {
  const [unresolved, setUnresolved] = useState<UnresolvedLink[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [unresResp, mapResp] = await Promise.all([
        fetchWithAuth("/v1/operations/legacy-links/unresolved"),
        fetchWithAuth("/v1/operations/legacy-links/mappings"),
      ]);
      setUnresolved(unresResp.links || []);
      setMappings(mapResp.mappings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load links");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredUnresolved = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return unresolved;
    return unresolved.filter((link) => link.url.toLowerCase().includes(needle));
  }, [search, unresolved]);

  const handleCreateMapping = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newSource.trim() || !newTarget.trim()) return;
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth("/v1/operations/legacy-links/mappings", {
        method: "POST",
        body: JSON.stringify({ source: newSource, target: newTarget }),
      });
      setSuccess(`Saved mapping for ${newSource}.`);
      setNewSource("");
      setNewTarget("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save mapping");
    }
  };

  const handleDeleteMapping = async (id: string) => {
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth(`/v1/operations/legacy-links/mappings/${id}`, {
        method: "DELETE",
      });
      setSuccess("Mapping deleted.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete mapping");
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Legacy link resolution
          </h2>
          <p className="text-sm text-muted-foreground">
            Persisted QR/link fallbacks from learning schema records.
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ChartNoAxesColumn className="h-4 w-4 text-amber-500" />
              Unresolved links
              <Badge variant="secondary">{filteredUnresolved.length}</Badge>
            </CardTitle>
            <CardDescription>Top unmatched legacy URLs by hits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search unresolved URL..."
                className="pl-8"
              />
            </div>
            {loading && <Skeleton className="h-24 w-full" />}
            {!loading && filteredUnresolved.length === 0 && (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No unresolved links.
              </div>
            )}
            {filteredUnresolved.map((link) => (
              <div
                key={link.url}
                className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{link.url}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last seen {new Date(link.lastSeen).toLocaleString("th-TH")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">{link.hits} hits</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setNewSource(link.url)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LinkIcon className="h-4 w-4 text-primary" />
              Active mappings
            </CardTitle>
            <CardDescription>Create or replace persisted redirects.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateMapping} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="source">Source URL</Label>
                <Input
                  id="source"
                  value={newSource}
                  onChange={(event) => setNewSource(event.target.value)}
                  placeholder="domain.com/student/read/xyz"
                  className="font-mono text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target">Target path</Label>
                <div className="relative">
                  <ExternalLink className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="target"
                    value={newTarget}
                    onChange={(event) => setNewTarget(event.target.value)}
                    placeholder="/articles/lvl1-intro"
                    className="pl-8 font-mono text-sm"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Save mapping
              </Button>
            </form>

            <Separator className="my-6" />

            <div className="space-y-3">
              {loading && <Skeleton className="h-24 w-full" />}
              {!loading && mappings.length === 0 && (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No active mappings.
                </div>
              )}
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-muted-foreground">
                      {mapping.source}
                    </p>
                    <p className="mt-1 truncate font-mono text-emerald-600">
                      {mapping.target}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                    onClick={() => handleDeleteMapping(mapping.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
