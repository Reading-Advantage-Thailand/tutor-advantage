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
  Trash2,
  ArrowLeft,
  CheckCircle2,
  FileText,
  ExternalLink,
  RotateCcw,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { fetchWithAuth } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";

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

type VerificationField = "idCard" | "bankBook" | "address";

interface VerificationItem {
  status?: string;
  comment?: string;
  updatedAt?: string;
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
  idCardImageUrl?: string;
  bankBookImageUrl?: string;
  verificationStatus: string;
  verificationComment?: string;
  settings?: {
    address?: string;
    bankAccountNumber?: string;
    verification?: Partial<Record<VerificationField, VerificationItem>>;
  };
  consentLogs: ConsentLog[];
  classes: UserClass[];
}

const verificationFieldLabels: Record<VerificationField, string> = {
  idCard: "ID card",
  bankBook: "Bank book",
  address: "Address",
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [verificationComment, setVerificationComment] = useState("");
  const [fieldComments, setFieldComments] = useState<Record<VerificationField, string>>({
    idCard: "",
    bankBook: "",
    address: "",
  });
  const [isVerifying, setIsVerifying] = useState<string | null>(null);
  const [imageViewer, setImageViewer] = useState<{ url: string; title: string } | null>(null);
  const [imageZoom, setImageZoom] = useState(1);

  const loadUser = useCallback(async () => {
    try {
      setLoadError(null);
      const resp = await fetchWithAuth(`/v1/users/${userId}`);
      setUser(resp.user);
      setVerificationComment(resp.user.verificationComment || "");
      const verification = resp.user.settings?.verification || {};
      setFieldComments({
        idCard: verification.idCard?.comment || "",
        bankBook: verification.bankBook?.comment || "",
        address: verification.address?.comment || "",
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not fetch user details");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const openImageViewer = (url: string, title: string) => {
    setImageViewer({ url, title });
    setImageZoom(1);
  };

  const closeImageViewer = () => {
    setImageViewer(null);
    setImageZoom(1);
  };

  const handleVerify = async (status: "VERIFIED" | "REJECTED", field: VerificationField | "ALL" = "ALL") => {
    if (!user) return;
    if (status === "REJECTED") {
      const hasReason =
        field === "ALL"
          ? verificationComment.trim()
          : fieldComments[field].trim() || verificationComment.trim();

      if (!hasReason) {
        alert("Please enter a rejection reason first.");
        return;
      }
    }

    setIsVerifying(field);
    try {
      await fetchWithAuth(`/v1/users/${user.id}/verify`, {
        method: "POST",
        body: JSON.stringify({
          status,
          comment: verificationComment,
          field,
          fieldComments,
        }),
      });
      loadUser();
    } catch {
      alert("Error updating verification status");
    } finally {
      setIsVerifying(null);
    }
  };

  const getFieldStatus = (field: VerificationField) => {
    return user?.settings?.verification?.[field]?.status || "UNVERIFIED";
  };

  const allVerificationFieldsVerified =
    getFieldStatus("idCard") === "VERIFIED" &&
    getFieldStatus("bankBook") === "VERIFIED" &&
    getFieldStatus("address") === "VERIFIED";

  const getFieldComment = (field: VerificationField) => fieldComments[field] || "";

  const renderVerificationActions = (field: VerificationField, imageUrl?: string) => {
    const status = getFieldStatus(field);
    const reason = getFieldComment(field);
    
    return (
      <div className="flex flex-col gap-2 mt-2">
        <div className="flex items-center justify-between">
          <Badge 
            variant={status === "VERIFIED" ? "secondary" : "outline"}
            className={
              status === "VERIFIED" ? "bg-emerald-500/10 text-emerald-600 border-transparent" :
              status === "PENDING" ? "bg-amber-500/10 text-amber-600 border-amber-500/40" :
              status === "REJECTED" ? "bg-red-500/10 text-red-600 border-red-500/40" : ""
            }
          >
            {status}
          </Badge>
          <div className="flex gap-1">
            <Button 
              size="sm"
              variant="ghost" 
              className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
              disabled={!!isVerifying || !imageUrl || status === "VERIFIED" || (!reason.trim() && !verificationComment.trim())}
              onClick={() => handleVerify("REJECTED", field)}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> ปฏิเสธ
            </Button>
            <Button 
              size="sm"
              variant="ghost"
              className="h-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
              disabled={!!isVerifying || !imageUrl || status === "VERIFIED"}
              onClick={() => handleVerify("VERIFIED", field)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> อนุมัติ
            </Button>
          </div>
        </div>
        {status !== "VERIFIED" && (
          <Textarea
            value={reason}
            onChange={(event) =>
              setFieldComments((current) => ({
                ...current,
                [field]: event.target.value,
              }))
            }
            placeholder={`Reason if ${verificationFieldLabels[field]} is rejected`}
            className="min-h-[68px] text-xs"
          />
        )}
        {status === "REJECTED" && reason && (
          <p className="rounded-md border border-red-500/30 bg-red-500/5 p-2 text-xs text-red-600">
            {reason}
          </p>
        )}
      </div>
    );
  };

  const handleDelete = async () => {
    if (!user || deleteConfirmText !== user.id) return;
    setIsDeleting(true);
    try {
      await fetchWithAuth(`/v1/users/${user.id}/anonymize`, {
        method: "POST",
      });
      alert(`User ${user.id} PII has been anonymized successfully.`);
      router.push("/users");
    } catch {
      alert("Error anonymizing user");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">Loading...</div>
    );
  }

  if (loadError || !user) {
    return (
      <div className="w-full max-w-3xl space-y-4">
        <Button
          variant="ghost"
          className="gap-2"
          onClick={() => router.push("/users")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to users
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load user details</AlertTitle>
          <AlertDescription>
            {loadError || "User not found"}
          </AlertDescription>
        </Alert>
        <Button
          type="button"
          onClick={() => {
            setLoading(true);
            loadUser();
          }}
        >
          Retry
        </Button>
      </div>
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

          {/* Verification Review (For Tutors) */}
          {user.role === "TUTOR" && (
            <Card className={user.verificationStatus === "PENDING" ? "border-amber-500/50 shadow-md shadow-amber-500/5" : ""}>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    การยืนยันตัวตน (Identity Verification)
                  </CardTitle>
                  <CardDescription>ตรวจสอบเอกสารประจำตัวและบัญชีธนาคาร</CardDescription>
                </div>
                <Badge 
                  variant={user.verificationStatus === "VERIFIED" ? "secondary" : "outline"}
                  className={
                    user.verificationStatus === "VERIFIED" ? "bg-emerald-500/10 text-emerald-600 border-transparent" :
                    user.verificationStatus === "PENDING" ? "bg-amber-500/10 text-amber-600 border-amber-500/40" :
                    user.verificationStatus === "REJECTED" ? "bg-red-500/10 text-red-600 border-red-500/40" : ""
                  }
                >
                  {user.verificationStatus}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">สำเนาบัตรประชาชน</Label>
                    {user.idCardImageUrl ? (
                      <div className="relative aspect-video rounded-lg border overflow-hidden bg-muted group">
                        <button
                          type="button"
                          className="block h-full w-full cursor-zoom-in"
                          onClick={() => openImageViewer(user.idCardImageUrl!, "สำเนาบัตรประชาชน")}
                        >
                          <img src={user.idCardImageUrl} alt="ID Card" className="object-cover w-full h-full" />
                        </button>
                        <div className="pointer-events-none absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" className="pointer-events-auto" asChild>
                            <a href={user.idCardImageUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3 w-3 mr-1" /> ดูรูปเต็ม
                            </a>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-lg border border-dashed flex flex-col items-center justify-center bg-muted/30 text-muted-foreground">
                        <UserIcon className="h-8 w-8 mb-2 opacity-20" />
                        <p className="text-xs">ไม่ได้อัปโหลด</p>
                      </div>
                    )}
                    {renderVerificationActions("idCard", user.idCardImageUrl)}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">หน้าสมุดบัญชี</Label>
                    <div className="rounded-md border bg-muted/20 p-3 text-sm">
                      <p className="text-xs text-muted-foreground">เลขบัญชีธนาคาร</p>
                      <p className="mt-0.5 font-mono font-semibold">
                        {user.settings?.bankAccountNumber || "ไม่ได้ระบุเลขบัญชี"}
                      </p>
                    </div>
                    {user.bankBookImageUrl ? (
                      <div className="relative aspect-video rounded-lg border overflow-hidden bg-muted group">
                        <button
                          type="button"
                          className="block h-full w-full cursor-zoom-in"
                          onClick={() => openImageViewer(user.bankBookImageUrl!, "หน้าสมุดบัญชี")}
                        >
                          <img src={user.bankBookImageUrl} alt="Bank Book" className="object-cover w-full h-full" />
                        </button>
                        <div className="pointer-events-none absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" className="pointer-events-auto" asChild>
                            <a href={user.bankBookImageUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3 w-3 mr-1" /> ดูรูปเต็ม
                            </a>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video rounded-lg border border-dashed flex flex-col items-center justify-center bg-muted/30 text-muted-foreground">
                        <FileText className="h-8 w-8 mb-2 opacity-20" />
                        <p className="text-xs">ไม่ได้อัปโหลด</p>
                      </div>
                    )}
                    {renderVerificationActions("bankBook", user.bankBookImageUrl)}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">ที่อยู่สำหรับส่งเอกสาร</Label>
                  <div className="p-3 border rounded-md bg-muted/20 text-sm">
                    {user.settings?.address || "ไม่ได้ระบุที่อยู่"}
                  </div>
                  {renderVerificationActions("address", user.settings?.address)}
                </div>

                {!allVerificationFieldsVerified && (
                  <>
                <Separator />

                <div className="space-y-3">
                  <Label htmlFor="verificationComment">ความเห็นหรือเหตุผลการปฏิเสธรวม (Global Comment)</Label>
                  <Textarea 
                    id="verificationComment"
                    placeholder="ระบุเหตุผลรวมสำหรับผลการตรวจสอบ..."
                    value={verificationComment}
                    onChange={(e) => setVerificationComment(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <div className="flex gap-3 justify-end">
                    <Button 
                      variant="outline" 
                      className="text-amber-600 border-amber-200 hover:bg-amber-50"
                      disabled={!!isVerifying || !verificationComment.trim()}
                      onClick={() => handleVerify("REJECTED", "ALL")}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      ปฏิเสธทั้งหมด
                    </Button>
                    <Button 
                      className="bg-primary text-primary-foreground"
                      disabled={!!isVerifying}
                      onClick={() => handleVerify("VERIFIED", "ALL")}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      อนุมัติทั้งหมด
                    </Button>
                  </div>
                </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

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

      {imageViewer && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/85 text-white"
          role="dialog"
          aria-modal="true"
          aria-label={imageViewer.title}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/70 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {imageViewer.title}
              </p>
              <p className="text-xs text-white/60">
                {Math.round(imageZoom * 100)}%
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => setImageZoom((zoom) => Math.max(0.5, zoom - 0.25))}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => setImageZoom(1)}
                aria-label="Reset zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => setImageZoom((zoom) => Math.min(4, zoom + 0.25))}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={closeImageViewer}
                aria-label="Close image viewer"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <img
                src={imageViewer.url}
                alt={imageViewer.title}
                className="max-h-[80vh] max-w-full rounded-md bg-white object-contain shadow-2xl"
                style={{
                  transform: `scale(${imageZoom})`,
                  transformOrigin: "center center",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
