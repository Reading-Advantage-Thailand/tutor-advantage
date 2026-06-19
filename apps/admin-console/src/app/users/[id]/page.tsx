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
import { toast } from "sonner";

import { fetchWithAuth, getAdminRole } from "@/lib/api";
import { useEffect, useState, useCallback, useRef } from "react";
import { t } from "@/lib/i18n";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import { IdentityVerificationCard } from "./components/IdentityVerificationCard";
import { ClassesCard } from "./components/ClassesCard";
import { PdpaConsentCard } from "./components/PdpaConsentCard";
import { BasicInfoCard } from "./components/BasicInfoCard";
import { RightToForgetCard } from "./components/RightToForgetCard";
import {
  UserDetail,
  VerificationField,
  verificationFieldLabels,
  BANK_BRAND_LABELS,
  VERIFICATION_STATUS_CONFIG,
  CLASS_STATUS_CONFIG
} from "./types";

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

  const [verificationComment, setVerificationComment] = useState("");
  const [fieldComments, setFieldComments] = useState<
    Record<VerificationField, string>
  >({
    idCard: "",
    bankBook: "",
    address: "",
    taxInfo: "",
  });
  const [isVerifying, setIsVerifying] = useState<string | null>(null);
  const [isSuspending, setIsSuspending] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  // Omise recipient ID editing state
  const [isEditingOmise, setIsEditingOmise] = useState(false);
  const [omiseRecipientInput, setOmiseRecipientInput] = useState("");
  const [isSavingOmise, setIsSavingOmise] = useState(false);

  const [imageViewer, setImageViewer] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const imageViewerRef = useRef<HTMLDivElement>(null);

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
        taxInfo: verification.taxInfo?.comment || "",
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

  const openImageViewer = (url: string, title: string) => {
    setImageViewer({ url, title });
    setImageZoom(1);
  };

  const closeImageViewer = () => {
    setImageViewer(null);
    setImageZoom(1);
  };

  useEffect(() => {
    if (!imageViewer) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeImageViewer();
    };
    window.addEventListener("keydown", handleKey);
    // Move focus to modal container when it opens
    imageViewerRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKey);
  }, [imageViewer]);

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
        toast.error("กรุณาระบุเหตุผลก่อนปฏิเสธ");
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
      toast.success("อัปเดตสถานะการยืนยันตัวตนเรียบร้อยแล้ว");
      await loadUser();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsVerifying(null);
    }
  };

  const handleSuspend = async () => {
    if (!user) return;
    setIsSuspending(true);
    try {
      const resp = await fetchWithAuth(`/v1/users/${user.id}/suspend`, {
        method: "POST",
      });
      toast.success(
        resp.isActive
          ? "เปิดใช้งานบัญชีเรียบร้อยแล้ว"
          : "ระงับบัญชีเรียบร้อยแล้ว",
      );
      await loadUser();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSuspending(false);
    }
  };

  const handleDelete = async () => {
    if (!user || deleteConfirmText !== user.id) return;
    setIsDeleting(true);
    try {
      await fetchWithAuth(`/v1/users/${user.id}/anonymize`, { method: "POST" });
      router.push("/users");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      setIsDeleting(false);
    }
  };

  const handleSaveOmiseRecipient = async () => {
    if (!user) return;
    setIsSavingOmise(true);
    try {
      await fetchWithAuth(`/v1/users/${user.id}/omise-recipient`, {
        method: "PATCH",
        body: JSON.stringify({ omiseRecipientId: omiseRecipientInput }),
      });
      toast.success("บันทึก Omise Recipient ID แล้ว");
      setIsEditingOmise(false);
      await loadUser();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsSavingOmise(false);
    }
  };

  const getFieldStatus = (field: VerificationField) =>
    user?.settings?.verification?.[field]?.status || "UNVERIFIED";

  const allVerified =
    getFieldStatus("idCard") === "VERIFIED" &&
    getFieldStatus("bankBook") === "VERIFIED" &&
    getFieldStatus("address") === "VERIFIED" &&
    getFieldStatus("taxInfo") === "VERIFIED";

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
          {t("userDetail.backToList")}
        </Button>
        <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-900/30">
          <div className="flex items-center gap-2 mb-2 font-bold">
            <AlertTriangle className="h-4 w-4" />
            <span>{t("userDetail.loadError")}</span>
          </div>
          <p className="text-sm font-medium">{loadError || t("userDetail.userNotFound")}</p>
        </div>
        <Button
          onClick={() => {
            setLoading(true);
            loadUser();
          }}
        >
          {t("userDetail.retryButton")}
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
        {t("userDetail.back")}
      </Button>

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
                    onClick={() => setConfirmSuspend(true)}
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
                    {user.status === "INACTIVE" ? t("userDetail.reactivate") : t("userDetail.suspendAccount")}
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
          <BasicInfoCard user={user} />

          {/* PDPA & Consent */}
          <PdpaConsentCard
            role={user.role}
            guardianSetup={user.guardianSetup}
            consentLogs={user.consentLogs}
          />
        </div>

        {/* Right column */}
        <div className="md:col-span-2 space-y-6">
          {/* Identity Verification (Tutors only) */}
          {user.role === "TUTOR" && (
            <IdentityVerificationCard
              user={user}
              adminRole={adminRole}
              isEditingOmise={isEditingOmise}
              setIsEditingOmise={setIsEditingOmise}
              omiseRecipientInput={omiseRecipientInput}
              setOmiseRecipientInput={setOmiseRecipientInput}
              isSavingOmise={isSavingOmise}
              handleSaveOmiseRecipient={handleSaveOmiseRecipient}
              openImageViewer={openImageViewer}
              allVerified={allVerified}
              verificationComment={verificationComment}
              setVerificationComment={setVerificationComment}
              isVerifying={isVerifying}
              handleVerify={handleVerify}
              renderVerificationActions={renderVerificationActions}
            />
          )}

          {/* Classes */}
          <ClassesCard role={user.role} classes={user.classes} />

          {/* Right to be Forgotten */}
          {isAdmin && (
            <RightToForgetCard
              userId={user.id}
              showDeleteConfirm={showDeleteConfirm}
              setShowDeleteConfirm={setShowDeleteConfirm}
              deleteConfirmText={deleteConfirmText}
              setDeleteConfirmText={setDeleteConfirmText}
              handleDelete={handleDelete}
              isDeleting={isDeleting}
            />
          )}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {imageViewer && (
        <div
          ref={imageViewerRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white outline-none"
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

      <ConfirmDialog
        open={confirmSuspend}
        onOpenChange={setConfirmSuspend}
        title={user.status === "INACTIVE" ? "ยืนยันเปิดใช้งานบัญชี" : "ยืนยันระงับบัญชี"}
        description={user.status === "INACTIVE"
          ? `เปิดใช้งานบัญชีของ ${user.name} อีกครั้ง?`
          : `ระงับบัญชีของ ${user.name}? ผู้ใช้จะไม่สามารถเข้าใช้งานได้จนกว่าจะเปิดใช้งานอีกครั้ง`
        }
        variant={user.status === "INACTIVE" ? "default" : "destructive"}
        confirmLabel={user.status === "INACTIVE" ? "เปิดใช้งาน" : "ระงับบัญชี"}
        cancelLabel="ยกเลิก"
        onConfirm={handleSuspend}
      />
    </div>
  );
}
