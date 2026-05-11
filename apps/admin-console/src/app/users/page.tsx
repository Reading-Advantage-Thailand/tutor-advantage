"use client";

import { useState } from "react";
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
import { Users, Search, ShieldCheck, User, GraduationCap, Bell, FileText } from "lucide-react";

import { fetchWithAuth } from "@/lib/api";
import { useEffect, useCallback } from "react";

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

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase()),
  );
  const pendingVerificationUsers = users.filter(
    (user) => user.role === "TUTOR" && (user.pendingVerificationCount || 0) > 0,
  );
  const pendingVerificationItems = pendingVerificationUsers.reduce(
    (sum, user) => sum + (user.pendingVerificationCount || 0),
    0,
  );

  return (
    <div className="space-y-6 w-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Users & Consent Management
          </CardTitle>
          <CardDescription>
            จัดการผู้ใช้งาน, สิทธิผู้ปกครอง, และประวัติความยินยอม (Privacy &
            PDPA)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="ค้นหาชื่อ, หรือ User ID..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {pendingVerificationItems > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-300">
              <Bell className="h-4 w-4" />
              เอกสารรอตรวจสอบ
            </CardTitle>
            <CardDescription>
              มี tutor ส่งเอกสารหรือข้อมูลยืนยันตัวตนเข้ามา {pendingVerificationItems} รายการ
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {pendingVerificationUsers.slice(0, 6).map((user) => (
              <Link href={`/users/${user.id}`} key={`pending-${user.id}`}>
                <div className="rounded-md border bg-background/80 p-3 transition-colors hover:border-amber-500/50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{user.name || user.id}</p>
                    <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                      {user.pendingVerificationCount}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {user.submittedVerificationFields?.map((item) => (
                      <Badge
                        key={item.field}
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-700 dark:text-amber-300"
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        {item.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => (
          <Link href={`/users/${user.id}`} key={user.id}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">
                      {user.name}
                    </p>
                    {user.role === "TUTOR" ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px] px-1.5 h-4"
                      >
                        Tutor
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-blue-500/40 text-blue-600 bg-blue-500/10 text-[10px] px-1.5 h-4"
                      >
                        Student
                      </Badge>
                    )}
                    {user.role === "TUTOR" && (user.pendingVerificationCount || 0) > 0 && (
                      <Badge className="bg-amber-500 text-white hover:bg-amber-500 text-[10px] px-1.5 h-4">
                        รอตรวจ {user.pendingVerificationCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground truncate">
                    {user.id}
                  </p>

                  <div className="pt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {user.role === "STUDENT" && (
                      <div className="flex items-center gap-1">
                        <ShieldCheck
                          className={`h-3 w-3 ${user.guardianSetup ? "text-emerald-500" : "text-amber-500"}`}
                        />
                        {user.guardianSetup ? "Guardian OK" : "No Guardian"}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      {user.role === "TUTOR" ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <GraduationCap className="h-3 w-3" />
                      )}
                      {user.activeClasses} Classes
                    </div>
                    {user.role === "TUTOR" && (user.pendingVerificationCount || 0) > 0 && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Bell className="h-3 w-3" />
                        {user.submittedVerificationFields?.map((item) => item.label).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {filteredUsers.length === 0 && (
          <p className="text-sm text-muted-foreground p-4">
            ไม่พบข้อมูลผู้ใช้งาน
          </p>
        )}
      </div>
    </div>
  );
}
