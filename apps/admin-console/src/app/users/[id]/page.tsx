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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Mail,
  Phone,
  CalendarDays,
  Power,
  AlertCircle,
  Clock,
  MapPin,
  CreditCard,
  Loader2,
  Users,
  Pencil,
  Save,
  X as XIcon,
} from "lucide-react";

import { fetchWithAuth, getAdminRole } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";

interface ConsentLog {
  id: string;
  version: string;
  type: string;
  status: string;
  timestamp: string;
}

interface UserClass {
  id: string;
  name: string;
  students: number;
  status: string;
  bookTitle?: string;
  startsAt?: string | null;
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
  phone?: string | null;
  role: string;
  status: string;
  joinedAt: string;
  profilePictureUrl?: string | null;
  guardianSetup: boolean;
  idCardImageUrl?: string | null;
  bankBookImageUrl?: string | null;
  verificationStatus: string;
  verificationComment?: string | null;
  settings?: {
    address?: string;
    bankAccountNumber?: string;
    omiseRecipientId?: string;
    verification?: Partial<Record<VerificationField, VerificationItem>>;
  };
  consentLogs: ConsentLog[];
  classes: UserClass[];
}

const verificationFieldLabels: Record<VerificationField, string> = {
  idCard: "สำเนาบัตรประชาชน",
  bankBook: "หน้าสมุดบัญชี",
  address: "ที่อยู่สำหรับส่งเอกสาร",
};

const VERIFICATION_STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ElementType }
> = {
  VERIFIED: {
    label: "ยืนยันตัวตนแล้ว",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    icon: CheckCircle2,
  },
  PENDING: {
    label: "รอตรวจสอบ",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    icon: Clock,
  },
  REJECTED: {
    label: "เอกสารถูกปฏิเสธ",
    className: "bg-red-500/10 text-red-600 border-red-500/30",
    icon: XCircle,
  },
  UNVERIFIED: {
    label: "ยังไม่ยืนยันตัวตน",
    className: "bg-muted text-muted-foreground border-transparent",
    icon: AlertCircle,
  },
};

const CLASS_STATUS_CONFIG: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  OPEN: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  PUBLISHED: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  IN_PROGRESS: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  FULL: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  COMPLETED: "bg-muted text-muted-foreground border-transparent",
  CANCELLED: "bg-red-500/10 text-red-600 border-red-500/30",
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const adminRole = typeof window !== "undefined" ? getAdminRole() : "";

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [verificationComment, setVerificationComment] = useState("");
  const [fieldComments, setFieldComments] = useState<
    Record<VerificationField, string>
  >({
    idCard: "",
    bankBook: "",
    address: "",
  });
  const [isVerifying, setIsVerifying] = useState<string | null>(null);
  const [isSuspending, setIsSuspending] = useState(false);

  // Omise recipient ID editing state
  const [isEditingOmise, setIsEditingOmise] = useState(false);
  const [omiseRecipientInput, setOmiseRecipientInput] = useState("");
  const [isSavingOmise, setIsSavingOmise] = useState(false);

  const [imageViewer, setImageViewer] = useState<{
    url: string;
    title: string;
  } | null>(null);
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
      setLoadError(
        err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลได้",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const clearMessages = () => {
    setActionMessage("");
    setActionError("");
  };

  const openImageViewer = (url: string, title: string) => {
    setImageViewer({ url, title });
    setImageZoom(1);
  };

  const closeImageViewer = () => {
    setImageViewer(null);
    setImageZoom(1);
  };

  const handleVerify = async (
    status: "VERIFIED" | "REJECTED",
    field: VerificationField | "ALL" = "ALL",
  ) => {
    if (!user) return;
    if (status === "REJECTED") {
      const hasReason =
        field === "ALL"
          ? verificationComment.trim()
          : fieldComments[field].trim() || verificationComment.trim();
      if (!hasReason) {
        setActionError("กรุณาระบุเหตุผลก่อนปฏิเสธ");
        return;
      }
    }

    setIsVerifying(field);
    clearMessages();
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
      setActionMessage("อัปเดตสถานะการยืนยันตัวตนเรียบร้อยแล้ว");
      await loadUser();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsVerifying(null);
    }
  };

  const handleSuspend = async () => {
    if (!user) return;
    setIsSuspending(true);
    clearMessages();
    try {
      const resp = await fetchWithAuth(`/v1/users/${user.id}/suspend`, {
        method: "POST",
      });
      setActionMessage(
        resp.isActive
          ? "เปิดใช้งานบัญชีเรียบร้อยแล้ว"
          : "ระงับบัญชีเรียบร้อยแล้ว",
      );
      await loadUser();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSuspending(false);
    }
  };

  const handleDelete = async () => {
    if (!user || deleteConfirmText !== user.id) return;
    setIsDeleting(true);
    clearMessages();
    try {
      await fetchWithAuth(`/v1/users/${user.id}/anonymize`, { method: "POST" });
      router.push("/users");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setIsDeleting(false);
    }
  };

  const handleSaveOmiseRecipient = async () => {
    if (!user) return;
    setIsSavingOmise(true);
    clearMessages();
    try {
      await fetchWithAuth(`/v1/users/${user.id}/omise-recipient`, {
        method: "PATCH",
        body: JSON.stringify({ omiseRecipientId: omiseRecipientInput }),
      });
      setActionMessage("บันทึก Omise Recipient ID แล้ว");
      setIsEditingOmise(false);
      await loadUser();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSavingOmise(false);
    }
  };

  const getFieldStatus = (field: VerificationField) =>
    user?.settings?.verification?.[field]?.status || "UNVERIFIED";

  const allVerified =
    getFieldStatus("idCard") === "VERIFIED" &&
    getFieldStatus("bankBook") === "VERIFIED" &&
    getFieldStatus("address") === "VERIFIED";

  /** hasDocument: true if the document/data is present and can be reviewed */
  const renderVerificationActions = (
    field: VerificationField,
    hasDocument: boolean,
  ) => {
    const status = getFieldStatus(field);
    const reason = fieldComments[field] || "";

    const fieldStatusCfg = {
      VERIFIED: {
        label: "ยืนยันแล้ว",
        cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/40",
      },
      PENDING: {
        label: "รอตรวจสอบ",
        cls: "bg-amber-500/10 text-amber-600 border-amber-500/40",
      },
      REJECTED: {
        label: "ปฏิเสธแล้ว",
        cls: "bg-red-500/10 text-red-600 border-red-500/40",
      },
      UNVERIFIED: {
        label: "ยังไม่ตรวจ",
        cls: "bg-muted text-muted-foreground",
      },
    }[status] || { label: status, cls: "" };

    return (
      <div className="flex flex-col gap-2 mt-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={`text-xs ${fieldStatusCfg.cls}`}>
            {fieldStatusCfg.label}
          </Badge>
          {status !== "VERIFIED" && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 text-xs"
                disabled={
                  !!isVerifying ||
                  !hasDocument ||
                  (!reason.trim() && !verificationComment.trim())
                }
                onClick={() => handleVerify("REJECTED", field)}
              >
                {isVerifying === field ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    ปฏิเสธ
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 px-2 text-xs"
                disabled={!!isVerifying || !hasDocument}
                onClick={() => handleVerify("VERIFIED", field)}
              >
                {isVerifying === field ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    อนุมัติ
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {status !== "VERIFIED" && (
          <Textarea
            value={reason}
            onChange={(e) =>
              setFieldComments((prev) => ({ ...prev, [field]: e.target.value }))
            }
            placeholder={`เหตุผลหากปฏิเสธ${verificationFieldLabels[field]}...`}
            className="min-h-[60px] text-xs resize-none"
          />
        )}

        {status === "REJECTED" &&
          user?.settings?.verification?.[field]?.updatedAt && (
            <p className="text-[10px] text-muted-foreground">
              อัปเดตล่าสุด:{" "}
              {new Date(
                user.settings.verification[field]!.updatedAt!,
              ).toLocaleString("th-TH")}
            </p>
          )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
        <div className="animate-spin h-10 w-10 border-4 border-muted-foreground/20 border-t-brand-500 rounded-full mb-4" />
        <p className="font-bold">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  if (loadError || !user) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4">
        <Button
          variant="ghost"
          className="gap-2"
          onClick={() => router.push("/users")}
        >
          <ArrowLeft className="h-4 w-4" />
          กลับไปรายการผู้ใช้
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>โหลดข้อมูลไม่สำเร็จ</AlertTitle>
          <AlertDescription>{loadError || "ไม่พบผู้ใช้งาน"}</AlertDescription>
        </Alert>
        <Button
          onClick={() => {
            setLoading(true);
            loadUser();
          }}
        >
          ลองใหม่
        </Button>
      </div>
    );
  }

  const vCfg =
    VERIFICATION_STATUS_CONFIG[user.verificationStatus] ??
    VERIFICATION_STATUS_CONFIG.UNVERIFIED;
  const VIcon = vCfg.icon;
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const isAdmin = adminRole === "ADMIN";

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
        onClick={() => router.push("/users")}
      >
        <ArrowLeft className="h-4 w-4" />
        ย้อนกลับ
      </Button>

      {/* Action messages */}
      {actionError && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>เกิดข้อผิดพลาด</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      {actionMessage && (
        <Alert className="rounded-2xl border-emerald-500/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700 font-medium">
            {actionMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Hero card */}
      <Card className="border-none shadow-lg rounded-3xl overflow-hidden bg-card">
        <CardContent className="p-6">
          <div className="flex gap-4 items-start">
            <Avatar className="h-16 w-16 shrink-0 border-4 border-background shadow-lg ring-1 ring-border/30 mt-0.5">
              {user.profilePictureUrl && (
                <AvatarImage
                  src={user.profilePictureUrl}
                  alt={user.name}
                  className="object-cover"
                />
              )}
              <AvatarFallback
                className={`text-xl font-black ${user.role === "TUTOR" ? "bg-gradient-to-br from-purple-400 to-brand-600 text-white" : "bg-gradient-to-br from-blue-400 to-blue-600 text-white"}`}
              >
                {initials || user.name[0]}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 space-y-1.5">
              {/* Name + badges + button — all in one flex-wrap row; button uses ml-auto */}
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black text-foreground leading-tight">
                  {user.name}
                </h1>
                {user.status === "INACTIVE" && (
                  <Badge
                    variant="outline"
                    className="border-red-300 text-red-600 bg-red-50 dark:bg-red-950/20 font-bold text-[10px]"
                  >
                    ถูกระงับ
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`font-bold text-[10px] ${user.role === "TUTOR" ? "border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/20" : "border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/20"}`}
                >
                  {user.role === "TUTOR" ? "ติวเตอร์" : "นักเรียน"}
                </Badge>
                {user.role === "TUTOR" && (
                  <Badge
                    variant="outline"
                    className={`font-bold text-[10px] ${vCfg.className}`}
                  >
                    <VIcon className="h-3 w-3 mr-1" />
                    {vCfg.label}
                  </Badge>
                )}
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSuspending}
                    onClick={handleSuspend}
                    className={`ml-auto shrink-0 gap-2 font-bold rounded-xl ${
                      user.status === "INACTIVE"
                        ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                        : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                    }`}
                  >
                    {isSuspending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Power className="h-4 w-4" />
                    )}
                    {user.status === "INACTIVE" ? "เปิดใช้งาน" : "ระงับบัญชี"}
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {user.email}
                </span>
                {user.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {user.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  {new Date(user.joinedAt).toLocaleDateString("th-TH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {user.classes.length}{" "}
                  {user.role === "TUTOR" ? "คลาสที่สอน" : "คลาสที่เรียน"}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {user.consentLogs.length} consent log
                </span>
              </div>
              {/* end: stats row */}
            </div>
            {/* end: flex-1 min-w-0 */}
          </div>
          {/* end: flex gap-4 items-start */}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-1 space-y-6">
          {/* Basic Info */}
          <Card className="border-none shadow-sm rounded-2xl bg-card">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                <UserIcon className="h-4 w-4" />
                ข้อมูลพื้นฐาน
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {[
                {
                  label: "User ID",
                  value: (
                    <span className="font-mono text-xs break-all">
                      {user.id}
                    </span>
                  ),
                },
                { label: "ชื่อ-นามสกุล", value: user.name },
                { label: "อีเมล", value: user.email },
                { label: "เบอร์โทรศัพท์", value: user.phone || "—" },
                {
                  label: "บทบาท",
                  value: user.role === "TUTOR" ? "ติวเตอร์" : "นักเรียน",
                },
                {
                  label: "สถานะบัญชี",
                  value: user.status === "ACTIVE" ? "ใช้งานอยู่" : "ถูกระงับ",
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {label}
                  </p>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {value}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* PDPA & Consent */}
          <Card className="border-none shadow-sm rounded-2xl bg-card">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4" />
                PDPA & Consent
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {user.role === "STUDENT" && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl border text-xs font-medium ${user.guardianSetup ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" : "border-amber-500/30 bg-amber-500/5 text-amber-700"}`}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {user.guardianSetup
                      ? "ผู้ปกครองยืนยันตัวตนและให้ความยินยอมแล้ว"
                      : "รอการยืนยันจากผู้ปกครอง"}
                  </span>
                </div>
              )}

              {user.consentLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  ยังไม่มีประวัติ Consent
                </p>
              ) : (
                <div className="space-y-2">
                  {user.consentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/40 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {log.type}
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          {new Date(log.timestamp).toLocaleDateString("th-TH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-600 border-none text-[10px]"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        ยอมรับแล้ว
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="md:col-span-2 space-y-6">
          {/* Identity Verification (Tutors only) */}
          {user.role === "TUTOR" && (
            <Card
              className={`border-none shadow-sm rounded-2xl bg-card ${user.verificationStatus === "PENDING" ? "ring-2 ring-amber-500/40" : ""}`}
            >
              <CardHeader className="px-6 pt-6 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-brand-600" />
                      การยืนยันตัวตน
                    </CardTitle>
                    <CardDescription className="mt-1">
                      ตรวจสอบเอกสารประจำตัวและบัญชีธนาคาร
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 font-bold ${vCfg.className}`}
                  >
                    <VIcon className="h-3 w-3 mr-1.5" />
                    {vCfg.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6 space-y-6">
                {/* ID Card */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5" />
                    สำเนาบัตรประชาชน
                  </Label>
                  {user.idCardImageUrl ? (
                    <div className="relative aspect-video rounded-xl border overflow-hidden bg-muted group">
                      <button
                        type="button"
                        className="block h-full w-full cursor-zoom-in"
                        onClick={() =>
                          openImageViewer(
                            user.idCardImageUrl!,
                            "สำเนาบัตรประชาชน",
                          )
                        }
                      >
                        <img
                          src={user.idCardImageUrl}
                          alt="ID Card"
                          className="object-cover w-full h-full"
                        />
                      </button>
                      <div className="pointer-events-none absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="pointer-events-auto gap-1.5"
                          asChild
                        >
                          <a
                            href={user.idCardImageUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-3 w-3" />
                            ดูรูปเต็ม
                          </a>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center bg-muted/30 text-muted-foreground">
                      <UserIcon className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-xs">ยังไม่ได้อัปโหลด</p>
                    </div>
                  )}
                  {renderVerificationActions("idCard", !!user.idCardImageUrl)}
                </div>

                <Separator />

                {/* Bank Book */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    หน้าสมุดบัญชีธนาคาร
                  </Label>
                  <div className="p-3 rounded-xl bg-muted/40 text-sm">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                      เลขบัญชี
                    </p>
                    <p className="font-mono font-semibold mt-0.5">
                      {user.settings?.bankAccountNumber || (
                        <span className="text-muted-foreground">
                          ไม่ได้ระบุ
                        </span>
                      )}
                    </p>
                  </div>
                  {user.bankBookImageUrl ? (
                    <div className="relative aspect-video rounded-xl border overflow-hidden bg-muted group">
                      <button
                        type="button"
                        className="block h-full w-full cursor-zoom-in"
                        onClick={() =>
                          openImageViewer(
                            user.bankBookImageUrl!,
                            "หน้าสมุดบัญชี",
                          )
                        }
                      >
                        <img
                          src={user.bankBookImageUrl}
                          alt="Bank Book"
                          className="object-cover w-full h-full"
                        />
                      </button>
                      <div className="pointer-events-none absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="pointer-events-auto gap-1.5"
                          asChild
                        >
                          <a
                            href={user.bankBookImageUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-3 w-3" />
                            ดูรูปเต็ม
                          </a>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center bg-muted/30 text-muted-foreground">
                      <FileText className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-xs">ยังไม่ได้อัปโหลด</p>
                    </div>
                  )}
                  {renderVerificationActions(
                    "bankBook",
                    !!user.bankBookImageUrl,
                  )}
                </div>

                <Separator />

                {/* Address */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    ที่อยู่สำหรับส่งเอกสาร
                  </Label>
                  <div className="p-3 rounded-xl bg-muted/40 text-sm min-h-[48px]">
                    {user.settings?.address || (
                      <span className="text-muted-foreground text-xs">
                        ไม่ได้ระบุที่อยู่
                      </span>
                    )}
                  </div>
                  {renderVerificationActions(
                    "address",
                    !!user.settings?.address,
                  )}
                </div>

                <Separator />

                {/* Omise Recipient ID */}
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    Omise Recipient ID
                  </Label>
                  {isEditingOmise ? (
                    <div className="flex gap-2">
                      <Input
                        value={omiseRecipientInput}
                        onChange={(e) => setOmiseRecipientInput(e.target.value)}
                        placeholder="recp_xxxxxxxxxxxxxxxxxxxxxxxx"
                        className="font-mono text-xs h-9"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-9 shrink-0"
                        disabled={isSavingOmise}
                        onClick={handleSaveOmiseRecipient}
                      >
                        {isSavingOmise ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 shrink-0"
                        disabled={isSavingOmise}
                        onClick={() => setIsEditingOmise(false)}
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-2.5 rounded-xl bg-muted/40 text-sm font-mono min-h-[36px] flex items-center">
                        {user.settings?.omiseRecipientId ? (
                          <span className="text-foreground">{user.settings.omiseRecipientId}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs font-sans">ยังไม่ได้ตั้งค่า</span>
                        )}
                      </div>
                      {adminRole === "ADMIN" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 shrink-0"
                          onClick={() => {
                            setOmiseRecipientInput(user.settings?.omiseRecipientId ?? "");
                            setIsEditingOmise(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Global action */}
                {!allVerified && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <div>
                        <Label
                          htmlFor="globalComment"
                          className="text-xs font-semibold text-muted-foreground"
                        >
                          ความเห็นรวม (สำหรับ Approve/Reject ทั้งหมดพร้อมกัน)
                        </Label>
                        <Textarea
                          id="globalComment"
                          placeholder="ระบุเหตุผลรวมสำหรับผลการตรวจสอบ..."
                          value={verificationComment}
                          onChange={(e) =>
                            setVerificationComment(e.target.value)
                          }
                          className="min-h-[72px] mt-1.5 resize-none"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold rounded-xl"
                          disabled={
                            !!isVerifying || !verificationComment.trim()
                          }
                          onClick={() => handleVerify("REJECTED", "ALL")}
                        >
                          {isVerifying === "ALL" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-1.5" />
                              ปฏิเสธทั้งหมด
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                          disabled={!!isVerifying}
                          onClick={() => handleVerify("VERIFIED", "ALL")}
                        >
                          {isVerifying === "ALL" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-1.5" />
                              อนุมัติทั้งหมด
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Classes */}
          <Card className="border-none shadow-sm rounded-2xl bg-card">
            <CardHeader className="px-6 pt-6 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-brand-600" />
                {user.role === "TUTOR" ? "คลาสที่รับผิดชอบ" : "คลาสที่ลงเรียน"}
                <Badge
                  variant="secondary"
                  className="ml-auto rounded-full font-bold"
                >
                  {user.classes.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              {user.classes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <BookOpen className="h-10 w-10 opacity-20 mb-2" />
                  <p className="text-sm">ยังไม่มีคลาส</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {user.classes.map((cls, index) => (
                    <div
                      key={`${cls.id}-${index}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate text-foreground">
                          {cls.name}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          {cls.bookTitle && <span>{cls.bookTitle}</span>}
                          {cls.startsAt && (
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {new Date(cls.startsAt).toLocaleDateString(
                                "th-TH",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {cls.students} คน
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 ml-3 text-[10px] font-bold ${CLASS_STATUS_CONFIG[cls.status] || ""}`}
                      >
                        {cls.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right to be Forgotten */}
          {isAdmin && (
            <Card className="border-none shadow-sm rounded-2xl bg-card border-red-500/20">
              <CardHeader className="px-6 pt-6 pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Trash2 className="h-4 w-4" />
                  Right to be Forgotten
                </CardTitle>
                <CardDescription>
                  ลบข้อมูลส่วนตัว (PII) ตามคำขอของเจ้าของข้อมูล —
                  ข้อมูลธุรกรรมยังคงอยู่เพื่อการตรวจสอบบัญชี
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {!showDeleteConfirm ? (
                  <Button
                    variant="destructive"
                    className="rounded-xl font-bold"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    เริ่มกระบวนการลบข้อมูล
                  </Button>
                ) : (
                  <div className="space-y-4 p-4 border border-red-500/30 rounded-2xl bg-red-500/5">
                    <Alert
                      variant="destructive"
                      className="bg-transparent border-none p-0"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>ยืนยันการทำ Data Anonymization</AlertTitle>
                      <AlertDescription>
                        การกระทำนี้ไม่สามารถย้อนกลับได้ พิมพ์{" "}
                        <span className="font-mono font-bold">{user.id}</span>{" "}
                        เพื่อยืนยัน
                      </AlertDescription>
                    </Alert>
                    <Input
                      placeholder="พิมพ์ User ID เพื่อยืนยัน"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="border-red-500/40 focus-visible:ring-red-500 font-mono"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText("");
                        }}
                      >
                        ยกเลิก
                      </Button>
                      <Button
                        variant="destructive"
                        className="rounded-xl font-bold"
                        disabled={deleteConfirmText !== user.id || isDeleting}
                        onClick={handleDelete}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        ยืนยันการลบข้อมูล
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {imageViewer && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white"
          role="dialog"
          aria-modal="true"
          aria-label={imageViewer.title}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{imageViewer.title}</p>
              <p className="text-xs text-white/50">
                {Math.round(imageZoom * 100)}%
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => setImageZoom((z) => Math.max(0.5, z - 0.25))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => setImageZoom(1)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => setImageZoom((z) => Math.min(4, z + 0.25))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={closeImageViewer}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            <img
              src={imageViewer.url}
              alt={imageViewer.title}
              className="max-h-[80vh] max-w-full rounded-lg bg-white object-contain shadow-2xl transition-transform duration-150"
              style={{
                transform: `scale(${imageZoom})`,
                transformOrigin: "center center",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
