"use client";

import { useParams, useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  User as UserIcon,
  ShieldCheck,
  AlertTriangle,
  BookOpen,
  History,
  Trash2,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

import { fetchWithAuth } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";

interface ConsentLog {
  id: string;
  version: string;
  type: string;
  timestamp: string;
}

interface UserClass {
  id: string;
  name: string;
  students: number;
  status: string;
}

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  joinedAt: string;
  guardianSetup: boolean;
  consentLogs: ConsentLog[];
  classes: UserClass[];
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const resp = await fetchWithAuth(`/v1/users/${userId}`);
      setUser(resp.user);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleDelete = async () => {
    if (!user || deleteConfirmText !== user.id) return;
    setIsDeleting(true);
    try {
      await fetchWithAuth(`/v1/users/${user.id}/anonymize`, {
        method: "POST",
      });
      alert(`User ${user.id} PII has been anonymized successfully.`);
      router.push("/users");
    } catch (err) {
      alert("Error anonymizing user");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="p-8 text-center text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/users")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">User Profile</h2>
          <p className="text-muted-foreground text-sm font-mono mt-0.5">
            {userId}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Summary */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-primary" />
              ข้อมูลพื้นฐาน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">ชื่อ-นามสกุล</p>
              <p className="font-medium mt-0.5">{user.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">อีเมล</p>
              <p className="font-medium mt-0.5">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">เบอร์โทรศัพท์</p>
              <p className="font-medium mt-0.5">{user.phone}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">บทบาท</p>
              <Badge
                variant="outline"
                className={`mt-1 ${user.role === "TUTOR" ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10" : "border-blue-500/40 text-blue-600 bg-blue-500/10"}`}
              >
                {user.role}
              </Badge>
            </div>
            <Separator />
            <div className="pt-2">
              <Button
                variant="outline"
                className="w-full text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                ระงับบัญชี (Suspend)
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          {/* Privacy & Consent */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                PDPA & Consent Logs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user.role === "STUDENT" && (
                <Alert
                  className={
                    user.guardianSetup
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-amber-500/30 bg-amber-500/5"
                  }
                >
                  <ShieldCheck
                    className={`h-4 w-4 ${user.guardianSetup ? "text-emerald-600" : "text-amber-600"}`}
                  />
                  <AlertTitle className="text-sm">
                    สถานะความยินยอมจากผู้ปกครอง (Guardian)
                  </AlertTitle>
                  <AlertDescription className="text-xs">
                    {user.guardianSetup
                      ? "ผู้ปกครองยืนยันตัวตนและให้ความยินยอมเรียบร้อยแล้ว"
                      : "รอการยืนยันจากผู้ปกครอง (จำกัดสิทธิ์การเข้าถึงข้อมูลและการเงิน)"}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  ประวัติการกดรับ Consent (Versioned)
                </p>
                <div className="rounded-md border bg-muted/30">
                  {user.consentLogs.map((log, i) => (
                    <div
                      key={log.id}
                      className={`flex items-center justify-between p-3 text-sm ${i !== 0 ? "border-t" : ""}`}
                    >
                      <div>
                        <p className="font-medium">{log.type}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Version: {log.version}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/10 text-emerald-600 border-transparent mb-1"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Accepted
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString("th-TH")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Classes / Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                {user.role === "TUTOR" ? "คลาสที่รับผิดชอบ" : "คลาสที่ลงเรียน"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {user.classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between p-3 border rounded-md"
                  >
                    <div>
                      <p className="font-medium text-sm">{cls.name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {cls.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground">
                        {cls.students} students
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          cls.status === "FULL"
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/40"
                            : ""
                        }
                      >
                        {cls.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              {user.role === "TUTOR" && (
                <div className="mt-4 pt-4 border-t flex justify-end">
                  <Button variant="outline" size="sm">
                    โอนย้ายคลาส (Reassign / Auction)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right to be Forgotten */}
          <Card className="border-red-500/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
                <Trash2 className="h-4 w-4" />
                Right to be Forgotten
              </CardTitle>
              <CardDescription>
                ลบข้อมูล PII ตามคำขอของเจ้าของข้อมูล (Anonymization)
                ข้อมูลเชิงธุรกรรมจะยังคงอยู่เพื่อการตรวจสอบทางบัญชี
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showDeleteConfirm ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  เริ่มกระบวนการลบข้อมูล (Soft Delete)
                </Button>
              ) : (
                <div className="space-y-4 p-4 border border-red-500/40 rounded-md bg-red-500/5">
                  <Alert
                    variant="destructive"
                    className="bg-transparent border-none p-0"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>ยืนยันการทำ Data Anonymization</AlertTitle>
                    <AlertDescription>
                      การกระทำนี้ไม่สามารถย้อนกลับได้ ข้อมูลชื่อ อีเมล เบอร์โทร
                      จะถูกเข้ารหัสทับทั้งหมด โปรดพิมพ์ User ID เพื่อยืนยัน:{" "}
                      <span className="font-mono font-bold">{user.id}</span>
                    </AlertDescription>
                  </Alert>
                  <Input
                    placeholder="พิมพ์ User ID เพื่อยืนยัน"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="border-red-500/40 focus-visible:ring-red-500"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText("");
                      }}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={deleteConfirmText !== user.id || isDeleting}
                      onClick={handleDelete}
                    >
                      {isDeleting ? "กำลังลบ..." : "ยืนยันการลบข้อมูล"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
