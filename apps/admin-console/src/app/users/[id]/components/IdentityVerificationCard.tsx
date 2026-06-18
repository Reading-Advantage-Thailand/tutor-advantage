import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, User as UserIcon, ExternalLink, CreditCard, MapPin, Loader2, Save, X as XIcon, Pencil, XCircle, CheckCircle2 } from "lucide-react";
import { UserDetail, VerificationField, BANK_BRAND_LABELS, VERIFICATION_STATUS_CONFIG } from "../types";

interface IdentityVerificationCardProps {
  user: UserDetail;
  adminRole: string;
  isEditingOmise: boolean;
  setIsEditingOmise: (v: boolean) => void;
  omiseRecipientInput: string;
  setOmiseRecipientInput: (v: string) => void;
  isSavingOmise: boolean;
  handleSaveOmiseRecipient: () => void;
  openImageViewer: (url: string, title: string) => void;
  allVerified: boolean;
  verificationComment: string;
  setVerificationComment: (v: string) => void;
  isVerifying: string | null;
  handleVerify: (status: "VERIFIED" | "REJECTED", field?: VerificationField | "ALL") => void;
  renderVerificationActions: (field: VerificationField, hasDocument: boolean) => React.ReactNode;
}

export function IdentityVerificationCard({
  user,
  adminRole,
  isEditingOmise,
  setIsEditingOmise,
  omiseRecipientInput,
  setOmiseRecipientInput,
  isSavingOmise,
  handleSaveOmiseRecipient,
  openImageViewer,
  allVerified,
  verificationComment,
  setVerificationComment,
  isVerifying,
  handleVerify,
  renderVerificationActions
}: IdentityVerificationCardProps) {
  const vCfg = VERIFICATION_STATUS_CONFIG[user.verificationStatus] ?? VERIFICATION_STATUS_CONFIG.UNVERIFIED;
  const VIcon = vCfg.icon;

  return (
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
          <div className="p-3 rounded-xl bg-muted/40 text-sm space-y-2">
            {user.settings?.bankBrand && (
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  ธนาคาร
                </p>
                <p className="font-semibold mt-0.5">
                  {BANK_BRAND_LABELS[user.settings.bankBrand] ?? user.settings.bankBrand}
                </p>
              </div>
            )}
            <div>
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

        {/* Tax Info */}
        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            ข้อมูลภาษีสำหรับใบ 50 ทวิ
          </Label>
          <div className="p-3 rounded-xl bg-muted/40 text-sm space-y-2">
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                ชื่อผู้มีเงินได้
              </p>
              <p className="font-semibold mt-0.5">
                {user.settings?.taxName || (
                  <span className="text-muted-foreground">
                    ไม่ได้ระบุ
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                เลขประจำตัวผู้เสียภาษี
              </p>
              <p className="font-mono font-semibold mt-0.5">
                {user.settings?.nationalId || (
                  <span className="text-muted-foreground">
                    ไม่ได้ระบุ
                  </span>
                )}
              </p>
            </div>
          </div>
          {renderVerificationActions(
            "taxInfo",
            !!user.settings?.taxName &&
              (user.settings?.nationalId?.replace(/\D/g, "").length ?? 0) === 13,
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
  );
}
