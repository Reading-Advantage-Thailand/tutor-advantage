"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Search, ShieldCheck, User, GraduationCap, Bell, FileText, ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/api";
import { t } from "@/lib/i18n";

interface UserInfo {
  id: string;
  name: string;
  role: string;
  email: string;
  activeClasses: number;
  status: string;
  joined: string;
  guardianSetup?: boolean;
  verificationStatus?: string;
  pendingVerificationCount?: number;
  submittedVerificationFields?: {
    field: string;
    label: string;
    updatedAt?: string;
  }[];
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterParam, setFilterParam] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilterParam(params.get("filter"));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetchWithAuth("/v1/users");
      setUsers(resp.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const searchFiltered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase()),
  );

  // Apply ?filter=pending from query string (used by the "Review Documents" CTA)
  const filteredUsers =
    filterParam === "pending"
      ? searchFiltered.filter(
          (u) => u.role === "TUTOR" && (u.pendingVerificationCount || 0) > 0,
        )
      : searchFiltered;

  const pendingVerificationUsers = users.filter(
    (user) => user.role === "TUTOR" && (user.pendingVerificationCount || 0) > 0,
  );
  
  const pendingVerificationItems = pendingVerificationUsers.reduce(
    (sum, user) => sum + (user.pendingVerificationCount || 0),
    0,
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tight text-foreground">{t("users.title")}</h2>
        <p className="text-muted-foreground font-medium">{t("users.description")}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Main Search Card */}
        <Card className="flex-1 overflow-hidden border-none shadow-sm rounded-3xl bg-card">
          <CardHeader className="pb-4 bg-muted/20 border-b px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-50 dark:bg-brand-900/20 rounded-xl text-brand-600 dark:text-brand-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">{t("users.directoryTitle")}</CardTitle>
                <CardDescription className="font-medium text-xs">
                  {t("users.directoryDescription")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="relative max-w-md w-full group">
              <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-brand-600 transition-colors" />
              <Input
                type="text"
                placeholder={t("users.searchPlaceholder")}
                className="pl-11 h-12 rounded-2xl border-2 focus-visible:ring-brand-500 font-medium bg-muted/30"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pending Verification Card - Only shows if there are pending items */}
        {pendingVerificationItems > 0 && (
          <Card className="md:max-w-md w-full overflow-hidden border-none shadow-md rounded-3xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 relative group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
               <ShieldAlert className="h-24 w-24 text-amber-600" />
            </div>
            <CardHeader className="pb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 rounded-xl text-white shadow-sm animate-pulse">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-amber-900 dark:text-amber-100">{t("users.actionRequired")}</CardTitle>
                  <CardDescription className="font-medium text-amber-700/80 dark:text-amber-400/80 text-xs">
                    {t("users.pendingVerificationPrefix")} {pendingVerificationItems} {t("users.pendingVerificationSuffix")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pb-6">
              <Button className="w-full rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md" asChild>
                <Link href="/users?filter=pending">
                  {t("users.reviewDocuments")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {filterParam === "pending" && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm font-semibold text-amber-700 dark:text-amber-400">
          <Bell className="h-4 w-4 shrink-0" />
          {t("users.pendingVerificationPrefix")} {pendingVerificationItems} {t("users.pendingVerificationSuffix")}
          <button
            className="ml-auto text-xs underline hover:no-underline"
            onClick={() => setFilterParam(null)}
          >
            ดูทั้งหมด
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
          <div className="animate-spin h-10 w-10 border-4 border-muted-foreground/20 border-t-brand-500 rounded-full mb-4" />
          <p className="font-bold text-muted-foreground">{t("users.loading")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <Link href={`/users/${user.id}`} key={user.id} className="block group">
              <Card className="h-full overflow-hidden border-none shadow-sm rounded-3xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-card group-hover:ring-2 group-hover:ring-brand-500/20">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-14 w-14 border-4 border-background shadow-sm ring-1 ring-border/50">
                      <AvatarFallback className="bg-gradient-to-br from-brand-400 to-brand-600 text-white text-lg font-bold">
                        {user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-base truncate text-foreground group-hover:text-brand-600 transition-colors">
                            {user.name}
                          </p>
                          <p className="text-xs font-mono text-muted-foreground truncate uppercase tracking-tight">
                            ID: {user.id.slice(0,8)}...
                          </p>
                        </div>
                        {user.role === "TUTOR" ? (
                          <Badge variant="outline" className="shrink-0 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/30 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            {t("users.tutor")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="shrink-0 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            {t("users.student")}
                          </Badge>
                        )}
                      </div>

                      <div className="pt-3 flex flex-wrap gap-2">
                        {user.role === "STUDENT" && (
                          <Badge variant="secondary" className={`rounded-md text-[10px] font-semibold border-none px-2 py-0.5 ${user.guardianSetup ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            {user.guardianSetup ? t("users.guardianVerified") : t("users.guardianPending")}
                          </Badge>
                        )}
                        
                        <Badge variant="secondary" className="bg-muted/50 text-muted-foreground rounded-md text-[10px] font-semibold border-none px-2 py-0.5">
                          {user.role === "TUTOR" ? <User className="h-3 w-3 mr-1" /> : <GraduationCap className="h-3 w-3 mr-1" />}
                          {user.activeClasses} {t("users.activeClassesSuffix")}
                        </Badge>

                        {user.role === "TUTOR" && (user.pendingVerificationCount || 0) > 0 && (
                          <Badge variant="secondary" className="bg-amber-500 text-white hover:bg-amber-600 rounded-md text-[10px] font-bold border-none px-2 py-0.5 shadow-sm">
                            <Bell className="h-3 w-3 mr-1" />
                            {user.pendingVerificationCount} {t("users.pendingItemsSuffix")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {!loading && filteredUsers.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="font-bold text-muted-foreground">{t("users.emptySearch")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
