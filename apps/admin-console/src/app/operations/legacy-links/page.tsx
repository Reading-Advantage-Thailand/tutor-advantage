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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Link as LinkIcon,
  Search,
  ExternalLink,
  Plus,
  Trash2,
  RefreshCw,
  ChartNoAxesColumn,
} from "lucide-react";

import { fetchWithAuth } from "@/lib/api";
import { useEffect, useCallback } from "react";

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
  const [loading, setLoading] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [unresResp, mapResp] = await Promise.all([
        fetchWithAuth("/v1/operations/legacy-links/unresolved"),
        fetchWithAuth("/v1/operations/legacy-links/mappings"),
      ]);
      setUnresolved(unresResp.links || []);
      setMappings(mapResp.mappings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData();
  };

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource || !newTarget) return;
    try {
      await fetchWithAuth("/v1/operations/legacy-links/mappings", {
        method: "POST",
        body: JSON.stringify({ source: newSource, target: newTarget }),
      });
      alert(`Created mapping: ${newSource} -> ${newTarget}`);
      setNewSource("");
      setNewTarget("");
      loadData();
    } catch (err) {
      alert("Error creating mapping");
    }
  };

  const handleDeleteMapping = async (id: string) => {
    try {
      await fetchWithAuth(`/v1/operations/legacy-links/mappings/${id}`, {
        method: "DELETE",
      });
      loadData();
    } catch (err) {
      alert("Error deleting mapping");
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Legacy Links Management
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            จัดการ URL เก่าจากตำรา QR Code รุ่นเดิม (Fallback Resolution)
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          รีเฟรชข้อมูล
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Unresolved Links Monitor */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ChartNoAxesColumn className="h-4 w-4 text-amber-500" />
              Unresolved Fallback Monitor
            </CardTitle>
            <CardDescription>
              URL ที่ผู้ใช้สแกนเข้ามาแล้วไม่พบในระบบใหม่ (Top Links)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4">
            {unresolved.map((link) => (
              <div
                key={link.url}
                className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 p-3 bg-muted/50 rounded-lg border"
              >
                <div className="overflow-hidden">
                  <p className="font-mono text-xs text-foreground truncate">
                    {link.url}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    ล่าสุด: {new Date(link.lastSeen).toLocaleString("th-TH")}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="secondary" className="font-mono">
                    {link.hits} hits
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setNewSource(link.url)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Create Mapping Form */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LinkIcon className="h-4 w-4 text-primary" />
              Create URL Mapping
            </CardTitle>
            <CardDescription>
              เพิ่มหรือแก้ไขกฎการเปลี่ยนเส้นทาง (Redirect Rate)
              ให้ตรงกับระบบใหม่
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateMapping} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="source">Source URL (Legacy)</Label>
                <Input
                  id="source"
                  placeholder="domain.com/student/read/xyz"
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  className="font-mono text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target">Target Path (New System)</Label>
                <div className="relative">
                  <ExternalLink className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="target"
                    placeholder="/articles/lvl1-intro"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    className="pl-8 font-mono text-sm"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4 mr-2" /> พิ่มการจับคู่
              </Button>
            </form>

            <Separator className="my-6" />

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Active Mappings (Recent)</h4>
              {mappings.map((map) => (
                <div
                  key={map.id}
                  className="flex items-center justify-between p-2 border rounded-md text-xs"
                >
                  <div className="overflow-hidden flex-1 mr-2">
                    <p className="font-mono truncate text-muted-foreground">
                      {map.source}
                    </p>
                    <p className="font-mono truncate text-emerald-600 dark:text-emerald-400 mt-0.5">
                      → {map.target}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    onClick={() => handleDeleteMapping(map.id)}
                  >
                    <Trash2 className="h-3 w-3" />
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
