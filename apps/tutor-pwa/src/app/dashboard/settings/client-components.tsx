"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogOut, Save, X, ChevronRight, Bell, Wallet, MapPin, Moon, Sun, TrendingUp, Volume2, VolumeX, ShieldCheck, Upload, AlertCircle } from "lucide-react";
import { useState, useEffect, useTransition } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { updateSettingsAction, submitVerificationAction, uploadFileAction, saveTaxInfoAction } from "../actions";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";

const verificationFieldLabels: Record<string, string> = {
  idCard: t("dashboardSettings.idCard"),
  bankBook: t("dashboardSettings.bankBook"),
  address: t("dashboardSettings.address"),
  taxInfo: t("dashboardSettings.taxInfoStep"),
};

export function SettingsInteractiveElements({ type, status }: { type: string; status?: string }) {
  const [showVerification, setShowVerification] = useState(false);

  if (type === "verificationButton") {
    if (status === "VERIFIED") return null;
    
    return (
      <>
        <Button
          variant={status === "REJECTED" ? "destructive" : "outline"}
          size="sm"
          className="w-full sm:w-auto mt-2 sm:mt-0"
          onClick={() => setShowVerification(true)}
        >
          {status === "PENDING" ? t("dashboardSettings.viewSubmission") : status === "REJECTED" ? t("dashboardSettings.resubmitDocuments") : t("dashboardSettings.verifyNow")}
        </Button>
        {/* Note: This button use might need updating to pass 'user' if used in a way that requires granular status */}
      </>
    );
  }

  if (type === "editProfileButton") {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full sm:w-auto mt-2 sm:mt-0"
      >
        {t("dashboardSettings.editProfile")}
      </Button>
    );
  }

  if (type === "themeToggleRow") {
    return <ThemeToggleRow />;
  }

  if (type === "soundToggleRow") {
    return <SoundToggleRow />;
  }

  if (type === "logoutSection") {
    const handleLogout = async () => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(console.error);
      window.location.href = "/";
    };

    return (
      <div className="pt-4 pb-8 flex justify-center">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 w-full sm:w-auto"
        >
          <LogOut className="w-4 h-4" />
          {t("dashboardSettings.logout")}
        </Button>
      </div>
    );
  }

  return null;
}

export function VerificationRow({ user }: { user: any }) {
  const [showVerification, setShowVerification] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const status = user.verificationStatus;
  const rejectedFields = Object.entries(user?.settings?.verification || {})
    .filter(([, detail]: any) => detail?.status === "REJECTED" && detail?.comment)
    .map(([field, detail]: any) => ({
      field,
      label: verificationFieldLabels[field] || field,
      comment: detail.comment,
    }));

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#verify") {
      setIsHighlighted(true);
      
      // Remove hash after highlight starts to prevent continuous flashing on reload
      setTimeout(() => {
        setIsHighlighted(false);
      }, 3000); // Pulse for 3 seconds
    }
  }, []);

  const getStatusText = () => {
    if (status === "VERIFIED") return t("dashboardSettings.verifiedStatusRow");
    if (status === "PENDING") return t("dashboardSettings.payoutPending");
    if (status === "REJECTED") return t("dashboardSettings.payoutRejected");
    return t("dashboardSettings.payoutUnverified");
  };

  const getButtonText = () => {
    if (status === "VERIFIED") return t("dashboardSettings.viewVerification");
    if (status === "PENDING") return t("dashboardSettings.viewProgress");
    if (status === "REJECTED") return t("dashboardSettings.resubmitShort");
    return t("dashboardSettings.verify");
  };

  return (
    <>
      <div 
        id="verify"
        className={cn(
          "space-y-3 p-4 sm:p-5 transition-all duration-500 scroll-mt-20 relative group",
          isHighlighted ? "bg-primary/10 ring-2 ring-primary/40 animate-pulse" : "hover:bg-brand-500/2 dark:hover:bg-brand-500/4"
        )}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-brand-500 transition-all duration-300" />
        <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300",
            status === "VERIFIED" ? "bg-emerald-500/10" :
            status === "REJECTED" ? "bg-destructive/10" : "bg-orange-500/10"
          )}>
            <ShieldCheck className={cn(
              "h-5 w-5",
              status === "VERIFIED" ? "text-emerald-500" :
              status === "REJECTED" ? "text-destructive" : "text-orange-500"
            )} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{t("dashboardSettings.payoutStatusTitle")}</p>
            <p className={cn(
              "text-xs font-semibold truncate mt-0.5",
              status === "VERIFIED" ? "text-emerald-600 dark:text-emerald-400" :
              status === "REJECTED" ? "text-destructive" : "text-muted-foreground"
            )}>
              {getStatusText()}
            </p>
          </div>
        </div>
        <div className="ml-3">
          <Button
            size="sm"
            variant={status === "REJECTED" ? "destructive" : "default"}
            onClick={() => setShowVerification(true)}
            className={cn(
              "h-8 text-xs font-bold px-4 rounded-xl whitespace-nowrap shadow-sm hover-lift press-scale",
              isHighlighted && "ring-4 ring-amber-300/80 ring-offset-2 ring-offset-background shadow-lg shadow-amber-500/25 animate-pulse",
              status === "VERIFIED" && "bg-emerald-500 hover:bg-emerald-600 text-white",
              status !== "REJECTED" && status !== "PENDING" && status !== "VERIFIED" && "bg-orange-500 hover:bg-orange-600 text-white"
            )}
          >
            {getButtonText()}
          </Button>
        </div>
        </div>
        {isHighlighted && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 animate-scale-in">
            กดปุ่มด้านขวาเพื่อกรอก/แก้ไขข้อมูลบัญชีและการเงิน
          </div>
        )}
        {rejectedFields.length > 0 && (
          <div className="space-y-1 rounded-xl border border-destructive/20 bg-destructive/5 p-3 sm:mx-2 animate-scale-in">
            {rejectedFields.map((item) => (
              <p key={item.field} className="text-xs text-destructive font-semibold">
                <span className="font-bold">{item.label}:</span> {item.comment}
              </p>
            ))}
          </div>
        )}
      </div>
      <VerificationModal 
        open={showVerification} 
        onOpenChange={setShowVerification} 
        user={user}
      />
    </>
  );
}

function SoundToggleRow() {
  const [isMuted, setIsMuted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setIsMuted(localStorage.getItem("app-notif-muted") === "true");
    }
  }, []);

  const toggleMute = (checked: boolean) => {
    const mute = !checked; // checked = true means NOT muted
    setIsMuted(mute);
    localStorage.setItem("app-notif-muted", String(mute));
  };

  return (
    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-brand-500/2 dark:hover:bg-brand-500/4 transition-all duration-300 relative group">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-brand-500 transition-all duration-300" />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
          {isMuted ? <VolumeX className="h-5 w-5 text-emerald-500" /> : <Volume2 className="h-5 w-5 text-emerald-500" />}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">
            {t("dashboardSettings.appSoundTitle")}
          </p>
          <p className="text-xs font-semibold text-muted-foreground/75 mt-0.5">{t("dashboardSettings.appSoundDescription")}</p>
        </div>
      </div>
      <div>
        {mounted && (
          <Switch 
            checked={!isMuted} 
            onCheckedChange={toggleMute} 
          />
        )}
      </div>
    </div>
  );
}

function ThemeToggleRow() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setMounted(true), []);

  // Use resolvedTheme to correctly identify active theme even when set to 'system'
  const isDark = mounted ? resolvedTheme === "dark" : false;

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-brand-500/2 dark:hover:bg-brand-500/4 transition-all duration-300 relative group">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-brand-500 transition-all duration-300" />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
          {(!mounted || !isDark) ? <Sun className="h-5 w-5 text-indigo-500" /> : <Moon className="h-5 w-5 text-indigo-500" />}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">
            {t("dashboardSettings.themeTitle")}
          </p>
          <p className={`text-xs font-semibold mt-0.5 transition-colors duration-300 ${saved ? "text-emerald-500" : "text-muted-foreground/75"}`}>
            {saved ? "บันทึกธีมแล้ว" : t("dashboardSettings.themeDescription")}
          </p>
        </div>
      </div>
      <div>
        {mounted && (
          <Switch
            checked={isDark}
            onCheckedChange={handleThemeChange}
          />
        )}
      </div>
    </div>
  );
}

const iconMap: Record<string, any> = { Bell, Wallet, MapPin, TrendingUp };

export function EditableSettingToggle({ title, description, iconName, value, settingKey, iconBgClass, iconColorClass }: any) {
  const Icon = iconMap[iconName] || Bell;
  const [isPending, startTransition] = useTransition();
  const [checked, setChecked] = useState(value === true);

  // Sync state if prop changes externally
  useEffect(() => {
    setChecked(value === true);
  }, [value]);

  const handleToggle = (newVal: boolean) => {
    setChecked(newVal);
    startTransition(async () => {
      try {
        await updateSettingsAction({ [settingKey]: newVal });
      } catch (e) {
        setChecked(!newVal); // revert
      }
    });
  };

  return (
    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-brand-500/2 dark:hover:bg-brand-500/4 transition-all duration-300 relative group">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-brand-500 transition-all duration-300" />
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${iconBgClass} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300`}>
          <Icon className={`h-5 w-5 ${iconColorClass}`} />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-xs font-semibold text-muted-foreground/75 mt-0.5">{description}</p>
        </div>
      </div>
      <div>
        <Switch checked={checked} onCheckedChange={handleToggle} disabled={isPending} />
      </div>
    </div>
  );
}

export function EditableSettingText({ title, description, iconName, value, settingKey, iconBgClass, iconColorClass, placeholder }: any) {
  const Icon = iconMap[iconName] || MapPin;
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(value || "");
  const [inputValue, setInputValue] = useState(value || "");

  // Sync from external value prop
  useEffect(() => {
    const currentVal = value || "";
    setText(currentVal);
    if (!isEditing) {
      setInputValue(currentVal);
    }
  }, [value, isEditing]);

  const handleStartEditing = () => {
    setInputValue(text);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setInputValue(text);
    setIsEditing(false);
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        // Optimistic update locally
        const newText = inputValue.trim();
        setText(newText);
        await updateSettingsAction({ [settingKey]: newText });
        setIsEditing(false);
      } catch (e) {
        console.error(e);
        // If failed, it will eventually re-sync from server props via useEffect
        // For immediate UX, we keep input open or could show toast.
      }
    });
  };

  if (isEditing) {
    return (
      <div className="p-4 sm:p-5 bg-brand-500/5 dark:bg-brand-500/10 border-l-4 border-l-brand-500 transition-all duration-300 animate-scale-in">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl ${iconBgClass} flex items-center justify-center shrink-0`}>
            <Icon className={`h-5 w-5 ${iconColorClass}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            placeholder={placeholder}
            disabled={isPending}
            className="flex-1 rounded-xl focus-visible:ring-brand-500/30 focus-visible:border-brand-500"
            autoFocus
          />
          <Button size="icon" variant="ghost" className="rounded-xl hover:bg-muted/50" onClick={handleCancel} disabled={isPending}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="icon" className="rounded-xl bg-brand-500 hover:bg-brand-600 text-white shadow-sm" onClick={handleSave} disabled={isPending}>
            <Save className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center justify-between p-4 sm:p-5 hover:bg-brand-500/2 dark:hover:bg-brand-500/4 transition-all duration-300 group cursor-pointer relative"
      onClick={handleStartEditing}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-brand-500 transition-all duration-300" />
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${iconBgClass} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300`}>
          <Icon className={`h-5 w-5 ${iconColorClass}`} />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="text-xs font-semibold text-muted-foreground/75 mt-0.5">{text || description}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-foreground transition-colors group-hover:translate-x-1 duration-300" />
    </div>
  );
}

const BANK_BRAND_LABELS: Record<string, string> = {
  kbank: "กสิกรไทย (KBank)",
  scb: "ไทยพาณิชย์ (SCB)",
  bbl: "กรุงเทพ (BBL)",
  bay: "กรุงศรีอยุธยา (BAY)",
  ttb: "ทีทีบี (TTB)",
  kiatnakin: "เกียรตินาคินภัทร (KKP)",
  cimb: "ซีไอเอ็มบี (CIMB)",
  gsb: "ออมสิน (GSB)",
  baac: "ธ.ก.ส. (BAAC)",
  uob: "ยูโอบี (UOB)",
  lhb: "แลนด์แอนด์เฮ้าส์ (LH Bank)",
};

function VerificationModal({ open, onOpenChange, user }: { open: boolean; onOpenChange: (open: boolean) => void; user: any }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isViewMode, setIsViewMode] = useState(user?.verificationStatus === "VERIFIED");

  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [bankBookFile, setBankBookFile] = useState<File | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null);
  const [bankBookPreview, setBankBookPreview] = useState<string | null>(null);
  const [submittedIdCardUrl, setSubmittedIdCardUrl] = useState<string | null>(user?.idCardImageUrl || null);
  const [submittedBankBookUrl, setSubmittedBankBookUrl] = useState<string | null>(user?.bankBookImageUrl || null);
  const [address, setAddress] = useState<string>(user?.settings?.address || "");
  const [bankAccountNumber, setBankAccountNumber] = useState<string>(user?.settings?.bankAccountNumber || "");
  const [bankBrand, setBankBrand] = useState<string>(user?.settings?.bankBrand || "");
  const [idCardError, setIdCardError] = useState<string | null>(null);
  const [bankBookError, setBankBookError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [taxName, setTaxName] = useState<string>(user?.settings?.taxName || "");
  const [nationalId, setNationalId] = useState<string>(user?.settings?.nationalId || "");
  const [taxInfoSaved, setTaxInfoSaved] = useState(false);
  const [taxInfoPending, setTaxInfoPending] = useState(false);

  // Reset view mode whenever modal is opened
  useEffect(() => {
    if (open) {
      setIsViewMode(user?.verificationStatus === "VERIFIED");
      setIdCardError(null);
      setBankBookError(null);
      setAddressError(null);
      setTaxInfoSaved(false);
    }
  }, [open, user?.verificationStatus]);

  useEffect(() => {
    setSubmittedIdCardUrl(user?.idCardImageUrl || null);
    setSubmittedBankBookUrl(user?.bankBookImageUrl || null);
    if (user?.settings?.address) {
      setAddress(user.settings.address);
    }
    if (user?.settings?.bankAccountNumber) {
      setBankAccountNumber(user.settings.bankAccountNumber);
    }
    if (user?.settings?.bankBrand) {
      setBankBrand(user.settings.bankBrand);
    }
    if (user?.settings?.taxName) setTaxName(user.settings.taxName);
    if (user?.settings?.nationalId) setNationalId(user.settings.nationalId);
  }, [user]);

  const getFieldStatus = (field: string) => {
    return user?.settings?.verification?.[field]?.status || "UNVERIFIED";
  };

  const getFieldComment = (field: string) => {
    return user?.settings?.verification?.[field]?.comment || "";
  };

  const renderFieldFeedback = (field: string) => {
    const comment = getFieldComment(field);
    if (getFieldStatus(field) !== "REJECTED" || !comment) return null;

    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        <p className="font-medium">{t("dashboardSettings.rejectReason")}</p>
        <p className="mt-1 leading-relaxed">{comment}</p>
      </div>
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'idCard' | 'bankBook') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'idCard') {
        setIdCardFile(file);
        setIdCardPreview(URL.createObjectURL(file));
      } else {
        setBankBookFile(file);
        setBankBookPreview(URL.createObjectURL(file));
      }
    }
  };

  const clearFieldError = (field: 'idCard' | 'bankBook' | 'address') => {
    if (field === 'idCard') setIdCardError(null);
    else if (field === 'bankBook') setBankBookError(null);
    else setAddressError(null);
  };

  const setFieldError = (field: 'idCard' | 'bankBook' | 'address', msg: string) => {
    if (field === 'idCard') setIdCardError(msg);
    else if (field === 'bankBook') setBankBookError(msg);
    else setAddressError(msg);
  };

  const handleSubmitField = (field: 'idCard' | 'bankBook' | 'address') => {
    clearFieldError(field);
    if (field === 'idCard' && !idCardFile) {
      setIdCardError(t("dashboardSettings.selectIdCardFile"));
      return;
    }
    if (field === 'bankBook' && !bankBookFile) {
      setBankBookError(t("dashboardSettings.selectBankBookFile"));
      return;
    }
    if (field === 'bankBook' && !bankAccountNumber.replace(/\D/g, "")) {
      setBankBookError(t("dashboardSettings.bankAccountRequired"));
      return;
    }
    if (field === 'bankBook' && !bankBrand) {
      setBankBookError("กรุณาเลือกธนาคาร");
      return;
    }
    if (field === 'address' && !address.trim()) {
      setAddressError(t("dashboardSettings.addressRequired"));
      return;
    }

    setActiveField(field);
    startTransition(async () => {
      try {
        let idCardUrl = undefined;
        let bankBookUrl = undefined;
        let addr = undefined;

        if (field === 'idCard' && idCardFile) {
          const idCardFormData = new FormData();
          idCardFormData.append("file", idCardFile);
          idCardUrl = await uploadFileAction(idCardFormData);
        } else if (field === 'bankBook' && bankBookFile) {
          const bankBookFormData = new FormData();
          bankBookFormData.append("file", bankBookFile);
          bankBookUrl = await uploadFileAction(bankBookFormData);
        } else if (field === 'address') {
          addr = address.trim();
        }

        await submitVerificationAction(
          idCardUrl,
          bankBookUrl,
          addr,
          field === 'bankBook' ? bankAccountNumber.replace(/\D/g, "") : undefined,
          field === 'bankBook' ? bankBrand : undefined,
        );

        // Success cleanup
        if (field === 'idCard') {
          if (idCardUrl) setSubmittedIdCardUrl(idCardUrl);
          setIdCardFile(null);
          setIdCardPreview(null);
        }
        if (field === 'bankBook') {
          if (bankBookUrl) setSubmittedBankBookUrl(bankBookUrl);
          setBankBookFile(null);
          setBankBookPreview(null);
        }
        router.refresh();

        setActiveField(null);
      } catch (err: any) {
        setFieldError(field, err.message || t("dashboardSettings.submitDocumentsFailed"));
        setActiveField(null);
      }
    });
  };

  const handleSaveTaxInfo = async () => {
    if (!taxName.trim() || nationalId.replace(/\D/g, "").length !== 13) return;
    setTaxInfoPending(true);
    try {
      await saveTaxInfoAction(taxName, nationalId);
      setTaxInfoSaved(true);
    } catch {
      // silently fail — keep inputs open
    } finally {
      setTaxInfoPending(false);
    }
  };

  const renderStatusBadge = (field: string) => {
    const status = getFieldStatus(field);
    if (status === "UNVERIFIED") return null;

    return (
      <Badge 
        variant="outline" 
        className={cn(
          "text-[10px] h-5 px-1.5",
          status === "VERIFIED" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" :
          status === "PENDING" ? "bg-amber-500/10 text-amber-600 border-amber-200" :
          "bg-red-500/10 text-red-600 border-red-200"
        )}
      >
        {status === "VERIFIED" ? t("dashboardSettings.verifiedBadge") : status === "PENDING" ? t("dashboardSettings.pendingBadge") : t("dashboardSettings.rejectedBadge")}
      </Badge>
    );
  };

  // VIEW MODE: read-only summary for verified users
  if (isViewMode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              {t("dashboardSettings.viewTitle")}
            </DialogTitle>
            <DialogDescription>{t("dashboardSettings.viewDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* ID Card */}
            <div className="space-y-2 p-4 border rounded-xl bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">{t("dashboardSettings.idCardStep")}</Label>
                {renderStatusBadge("idCard")}
              </div>
              {submittedIdCardUrl ? (
                <img src={submittedIdCardUrl} alt="ID Card" className="w-full aspect-video object-contain rounded-md" />
              ) : (
                <p className="text-xs text-muted-foreground">{t("dashboardSettings.notUploaded")}</p>
              )}
            </div>

            {/* Bank Book */}
            <div className="space-y-2 p-4 border rounded-xl bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">{t("dashboardSettings.bankBookStep")}</Label>
                {renderStatusBadge("bankBook")}
              </div>
              {user?.settings?.bankBrand && (
                <p className="text-xs font-medium text-foreground">
                  {t("dashboardSettings.bankBrandLabel")} {BANK_BRAND_LABELS[user.settings.bankBrand] || user.settings.bankBrand}
                </p>
              )}
              {user?.settings?.bankAccountNumber && (
                <p className="text-xs font-semibold text-foreground">
                  {t("dashboardSettings.bankAccountLabel")} {user.settings.bankAccountNumber}
                </p>
              )}
              {submittedBankBookUrl ? (
                <img src={submittedBankBookUrl} alt="Bank Book" className="w-full aspect-video object-contain rounded-md" />
              ) : (
                <p className="text-xs text-muted-foreground">{t("dashboardSettings.notUploaded")}</p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2 p-4 border rounded-xl bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">{t("dashboardSettings.addressStep")}</Label>
                {renderStatusBadge("address")}
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {user?.settings?.address || <span className="text-muted-foreground">{t("dashboardSettings.notUploaded")}</span>}
              </p>
            </div>

            {/* Tax Info */}
            <div className="space-y-2 p-4 border rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40">
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-blue-700 dark:text-blue-400">{t("dashboardSettings.taxInfoStep")}</Label>
                {renderStatusBadge("taxInfo")}
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium">{t("dashboardSettings.taxNameLabel")}</p>
                <p className="text-sm text-foreground font-semibold">
                  {user?.settings?.taxName || <span className="text-muted-foreground italic">–</span>}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium">{t("dashboardSettings.nationalIdLabel")}</p>
                <p className="text-sm text-foreground font-mono font-semibold">
                  {user?.settings?.nationalId || <span className="text-muted-foreground italic">–</span>}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between flex-col sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("dashboardSettings.closeDialog")}
            </Button>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={() => setIsViewMode(false)}
            >
              {t("dashboardSettings.editVerification")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // EDIT MODE
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t("dashboardSettings.modalTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("dashboardSettings.modalDescription")}
          </DialogDescription>
        </DialogHeader>

        {/* Step progress indicator */}
        <div className="px-1 pt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground">ความคืบหน้าการยืนยัน</span>
            <span className="text-xs font-bold text-foreground">
              {[
                getFieldStatus("idCard") !== "UNVERIFIED",
                getFieldStatus("bankBook") !== "UNVERIFIED",
                getFieldStatus("address") !== "UNVERIFIED",
                (user?.settings?.taxName && user?.settings?.nationalId),
              ].filter(Boolean).length} / 4 ขั้นตอน
            </span>
          </div>
          <div className="flex gap-1.5">
            {[
              { label: "บัตรประชาชน", done: getFieldStatus("idCard") !== "UNVERIFIED" },
              { label: "บัญชีธนาคาร", done: getFieldStatus("bankBook") !== "UNVERIFIED" },
              { label: "ที่อยู่", done: getFieldStatus("address") !== "UNVERIFIED" },
              { label: "ข้อมูลภาษี", done: !!(user?.settings?.taxName && user?.settings?.nationalId) },
            ].map((step, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-full transition-colors ${step.done ? "bg-primary" : "bg-muted"}`} />
                <span className="text-[9px] font-semibold text-muted-foreground hidden sm:block">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6 py-4">
          {/* Warning banner when editing previously verified data */}
          {user?.verificationStatus === "VERIFIED" && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 text-xs p-3 rounded-xl flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{t("dashboardSettings.editVerificationWarning")}</p>
            </div>
          )}

          {/* ID CARD SECTION */}
          <div className="space-y-3 p-4 border rounded-xl bg-muted/20 relative">
            {renderFieldFeedback("idCard")}
            {idCardError && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {idCardError}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="id-card" className="font-semibold flex items-center gap-2">
                {t("dashboardSettings.idCardStep")} {renderStatusBadge("idCard")}
              </Label>
            </div>
            
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-4 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50",
                idCardPreview ? 'border-primary/50 bg-primary/5' : 'border-border',
              )}
              onClick={() => document.getElementById('id-card-input')?.click()}
            >
              {idCardPreview ? (
                <div className="relative w-full">
                  <img src={idCardPreview} alt="ID Card Preview" className="w-full aspect-video object-contain rounded-md" />
                  <p className="mt-2 text-center text-xs text-primary">{t("dashboardSettings.selectedFilePendingUpload")}</p>
                </div>
              ) : submittedIdCardUrl ? (
                <div className="relative w-full">
                  <img src={submittedIdCardUrl} alt="Uploaded ID card" className="w-full aspect-video object-contain rounded-md" />
                  <p className="mt-2 text-center text-xs text-muted-foreground">{t("dashboardSettings.uploadedImage")}</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground text-center">{t("dashboardSettings.fileDropHint")}</p>
                </>
              )}
              <input
                id="id-card-input"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'idCard')}
                disabled={isPending}
              />
            </div>

            <Button
              size="sm"
              className="w-full gap-2"
              disabled={!idCardFile || (isPending && activeField === 'idCard')}
              onClick={() => handleSubmitField('idCard')}
            >
              {activeField === 'idCard' ? t("dashboardSettings.uploading") : t("dashboardSettings.uploadIdCard")}
            </Button>
          </div>

          {/* BANK BOOK SECTION */}
          <div className="space-y-3 p-4 border rounded-xl bg-muted/20">
            {renderFieldFeedback("bankBook")}
            {bankBookError && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {bankBookError}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="bank-book" className="font-semibold flex items-center gap-2">
                {t("dashboardSettings.bankBookStep")} {renderStatusBadge("bankBook")}
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank-brand" className="text-xs text-muted-foreground">
                ธนาคาร
              </Label>
              <select
                id="bank-brand"
                value={bankBrand}
                onChange={(e) => setBankBrand(e.target.value)}
                disabled={isPending}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">-- เลือกธนาคาร --</option>
                <option value="kbank">กสิกรไทย (KBank)</option>
                <option value="scb">ไทยพาณิชย์ (SCB)</option>
                <option value="bbl">กรุงเทพ (BBL)</option>
                <option value="bay">กรุงศรีอยุธยา (BAY)</option>
                <option value="ttb">ทีทีบี (TTB)</option>
                <option value="kiatnakin">เกียรตินาคินภัทร (KKP)</option>
                <option value="cimb">ซีไอเอ็มบี (CIMB)</option>
                <option value="gsb">ออมสิน (GSB)</option>
                <option value="baac">ธ.ก.ส. (BAAC)</option>
                <option value="uob">ยูโอบี (UOB)</option>
                <option value="lhb">แลนด์แอนด์เฮ้าส์ (LH Bank)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank-account-number" className="text-xs text-muted-foreground">
                {t("dashboardSettings.bankAccountNumber")}
              </Label>
              <Input
                id="bank-account-number"
                inputMode="numeric"
                placeholder={t("dashboardSettings.bankAccountNumberPlaceholder")}
                value={bankAccountNumber}
                onChange={(event) =>
                  setBankAccountNumber(event.target.value.replace(/[^\d-]/g, ""))
                }
                disabled={isPending}
              />
            </div>
            
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-4 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50",
                bankBookPreview ? 'border-primary/50 bg-primary/5' : 'border-border',
              )}
              onClick={() => document.getElementById('bank-book-input')?.click()}
            >
              {bankBookPreview ? (
                <div className="relative w-full">
                  <img src={bankBookPreview} alt="Bank Book Preview" className="w-full aspect-video object-contain rounded-md" />
                  <p className="mt-2 text-center text-xs text-primary">{t("dashboardSettings.selectedFilePendingUpload")}</p>
                </div>
              ) : submittedBankBookUrl ? (
                <div className="relative w-full">
                  <img src={submittedBankBookUrl} alt="Uploaded bank book" className="w-full aspect-video object-contain rounded-md" />
                  <p className="mt-2 text-center text-xs text-muted-foreground">{t("dashboardSettings.uploadedImage")}</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground text-center">{t("dashboardSettings.fileDropHint")}</p>
                </>
              )}
              <input
                id="bank-book-input"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'bankBook')}
                disabled={isPending}
              />
            </div>

            <Button
              size="sm"
              className="w-full gap-2"
              disabled={!bankBookFile || !bankAccountNumber.replace(/\D/g, "") || !bankBrand || (isPending && activeField === 'bankBook')}
              onClick={() => handleSubmitField('bankBook')}
            >
              {activeField === 'bankBook' ? t("dashboardSettings.uploading") : t("dashboardSettings.uploadBankBook")}
            </Button>
          </div>

          {/* ADDRESS SECTION */}
          <div className="space-y-3 p-4 border rounded-xl bg-muted/20">
            {renderFieldFeedback("address")}
            {addressError && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {addressError}
              </div>
            )}
            <Label htmlFor="address" className="font-semibold flex items-center gap-2">
              {t("dashboardSettings.addressStep")} {renderStatusBadge("address")}
            </Label>
            <textarea
              id="address"
              placeholder={t("dashboardSettings.fullAddressPlaceholder")}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isPending}
            />

            <Button
              size="sm"
              className="w-full gap-2"
              disabled={!address.trim() || address === user?.settings?.address || (isPending && activeField === 'address')}
              onClick={() => handleSubmitField('address')}
            >
              {activeField === 'address' ? t("dashboardSettings.saving") : t("dashboardSettings.saveAddress")}
            </Button>
          </div>

          {/* TAX INFO SECTION */}
          <div className="space-y-3 p-4 border rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40">
            {renderFieldFeedback("taxInfo")}
            <Label className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
              {t("dashboardSettings.taxInfoStep")} {renderStatusBadge("taxInfo")}
            </Label>
            <p className="text-xs text-muted-foreground">ใช้สำหรับออกใบ 50 ทวิ — กรอกตามบัตรประชาชน</p>
            <div className="space-y-2">
              <Label htmlFor="tax-name" className="text-xs text-muted-foreground">
                {t("dashboardSettings.taxNameLabel")}
              </Label>
              <Input
                id="tax-name"
                placeholder={t("dashboardSettings.taxNamePlaceholder")}
                value={taxName}
                onChange={(e) => { setTaxName(e.target.value); setTaxInfoSaved(false); }}
                disabled={taxInfoPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="national-id" className="text-xs text-muted-foreground">
                {t("dashboardSettings.nationalIdLabel")}
              </Label>
              <Input
                id="national-id"
                inputMode="numeric"
                placeholder={t("dashboardSettings.nationalIdPlaceholder")}
                value={nationalId}
                onChange={(e) => { setNationalId(e.target.value.replace(/[^\d-]/g, "")); setTaxInfoSaved(false); }}
                disabled={taxInfoPending}
              />
            </div>
            <Button
              size="sm"
              className={cn("w-full gap-2", taxInfoSaved && "bg-emerald-500 hover:bg-emerald-600 text-white")}
              disabled={!taxName.trim() || nationalId.replace(/\D/g, "").length !== 13 || taxInfoPending}
              onClick={handleSaveTaxInfo}
            >
              {taxInfoPending
                ? t("dashboardSettings.savingTaxInfo")
                : taxInfoSaved
                  ? "ส่งข้อมูลให้แอดมินตรวจสอบแล้ว"
                  : t("dashboardSettings.saveTaxInfo")}
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between flex-col sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("dashboardSettings.closeDialog")}
          </Button>
          {user?.verificationStatus === "VERIFIED" && (
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setIsViewMode(true)} disabled={isPending}>
              {t("dashboardSettings.cancelEdit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
