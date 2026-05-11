"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LogOut, Save, X, ChevronRight, Bell, Wallet, MapPin, Moon, Sun, TrendingUp, Volume2, VolumeX, ShieldCheck, Upload, AlertCircle } from "lucide-react";
import { useState, useEffect, useTransition } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { updateSettingsAction, submitVerificationAction, uploadFileAction } from "../actions";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const verificationFieldLabels: Record<string, string> = {
  idCard: "บัตรประชาชน",
  bankBook: "สมุดบัญชีธนาคาร",
  address: "ที่อยู่สำหรับส่งเอกสาร",
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
          {status === "PENDING" ? "ดูข้อมูลการส่ง" : status === "REJECTED" ? "ส่งเอกสารใหม่" : "ยืนยันตัวตนเลย"}
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
        แก้ไขโปรไฟล์
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
    const handleLogout = () => {
      window.location.href = "/api/auth/logout";
    };

    return (
      <div className="pt-4 pb-8 flex justify-center">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 w-full sm:w-auto"
        >
          <LogOut className="w-4 h-4" />
          ออกจากระบบ
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
    if (status === "PENDING") return "กำลังดำเนินการตรวจสอบ";
    if (status === "REJECTED") return "ข้อมูลถูกปฏิเสธ กรุณาส่งใหม่";
    return "กรุณายืนยันตัวตนก่อนระบุบัญชีรับเงิน";
  };

  const getButtonText = () => {
    if (status === "PENDING") return "ดูความคืบหน้า";
    if (status === "REJECTED") return "ส่งใหม่";
    return "ยืนยันตัวตน";
  };

  return (
    <>
      <div 
        id="verify"
        className={cn(
          "space-y-3 p-4 sm:p-5 transition-all duration-500 scroll-mt-20",
          isHighlighted ? "bg-primary/10 ring-2 ring-primary/40 animate-pulse" : "hover:bg-muted/30"
        )}
      >
        <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            status === "REJECTED" ? "bg-destructive/10" : "bg-orange-500/10"
          )}>
            <ShieldCheck className={cn(
              "h-5 w-5",
              status === "REJECTED" ? "text-destructive" : "text-orange-500"
            )} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">สถานะบัญชีรับเงิน</p>
            <p className={cn(
              "text-xs truncate",
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
              "h-8 text-xs px-3 whitespace-nowrap shadow-sm",
              status !== "REJECTED" && status !== "PENDING" && "bg-orange-500 hover:bg-orange-600 text-white"
            )}
          >
            {getButtonText()}
          </Button>
        </div>
        </div>
        {rejectedFields.length > 0 && (
          <div className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            {rejectedFields.map((item) => (
              <p key={item.field} className="text-xs text-destructive">
                <span className="font-medium">{item.label}:</span> {item.comment}
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
    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          {isMuted ? <VolumeX className="h-5 w-5 text-emerald-500" /> : <Volume2 className="h-5 w-5 text-emerald-500" />}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            เสียงแจ้งเตือนแอพ
          </p>
          <p className="text-xs text-muted-foreground">เปิด/ปิดเสียงเมื่อมีข้อความเข้า</p>
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
  useEffect(() => setMounted(true), []);

  // Use resolvedTheme to correctly identify active theme even when set to 'system'
  const isDark = mounted ? resolvedTheme === "dark" : false;

  return (
    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          {(!mounted || !isDark) ? <Sun className="h-5 w-5 text-indigo-500" /> : <Moon className="h-5 w-5 text-indigo-500" />}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            ลักษณะที่ปรากฏ (Theme)
          </p>
          <p className="text-xs text-muted-foreground">สลับโหมดสว่าง/มืด</p>
        </div>
      </div>
      <div>
        {mounted && (
          <Switch 
            checked={isDark} 
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} 
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
    <div className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBgClass} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColorClass}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
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
      <div className="p-4 sm:p-5 bg-muted/10 transition-colors">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-lg ${iconBgClass} flex items-center justify-center shrink-0`}>
            <Icon className={`h-5 w-5 ${iconColorClass}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Input 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            placeholder={placeholder}
            disabled={isPending}
            className="flex-1"
            autoFocus
          />
          <Button size="icon" variant="ghost" onClick={handleCancel} disabled={isPending}>
            <X className="h-4 w-4" />
          </Button>
          <Button size="icon" onClick={handleSave} disabled={isPending}>
            <Save className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors group cursor-pointer"
      onClick={handleStartEditing}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBgClass} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColorClass}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{text || description}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
    </div>
  );
}

function VerificationModal({ open, onOpenChange, user }: { open: boolean; onOpenChange: (open: boolean) => void; user: any }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeField, setActiveField] = useState<string | null>(null);
  
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [bankBookFile, setBankBookFile] = useState<File | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null);
  const [bankBookPreview, setBankBookPreview] = useState<string | null>(null);
  const [submittedIdCardUrl, setSubmittedIdCardUrl] = useState<string | null>(user?.idCardImageUrl || null);
  const [submittedBankBookUrl, setSubmittedBankBookUrl] = useState<string | null>(user?.bankBookImageUrl || null);
  const [address, setAddress] = useState<string>(user?.settings?.address || "");
  const [bankAccountNumber, setBankAccountNumber] = useState<string>(user?.settings?.bankAccountNumber || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSubmittedIdCardUrl(user?.idCardImageUrl || null);
    setSubmittedBankBookUrl(user?.bankBookImageUrl || null);
    if (user?.settings?.address) {
      setAddress(user.settings.address);
    }
    if (user?.settings?.bankAccountNumber) {
      setBankAccountNumber(user.settings.bankAccountNumber);
    }
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
        <p className="font-medium">เหตุผลที่ไม่ผ่าน</p>
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

  const handleSubmitField = (field: 'idCard' | 'bankBook' | 'address') => {
    setError(null);
    if (field === 'idCard' && !idCardFile) {
      setError("กรุณาเลือกไฟล์บัตรประชาชน");
      return;
    }
    if (field === 'bankBook' && !bankBookFile) {
      setError("กรุณาเลือกไฟล์หน้าสมุดบัญชี");
      return;
    }
    if (field === 'bankBook' && !bankAccountNumber.replace(/\D/g, "")) {
      setError("กรุณากรอกเลขบัญชีธนาคาร");
      return;
    }
    if (field === 'address' && !address.trim()) {
      setError("กรุณากรอกที่อยู่");
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
        setError(err.message || "เกิดข้อผิดพลาดในการส่งเอกสาร");
        setActiveField(null);
      }
    });
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
        {status === "VERIFIED" ? "ตรวจสอบแล้ว" : status === "PENDING" ? "รอการตรวจสอบ" : "ปฏิเสธ/ส่งใหม่"}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            ยืนยันตัวตนทีละขั้นตอน
          </DialogTitle>
          <DialogDescription>
            คุณสามารถทยอยอัปโหลดเอกสารทีละอย่างได้ เมื่อตรวจสอบผ่านแล้วข้อมูลจะถูกล๊อคไม่ให้แก้ไข
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* ID CARD SECTION */}
          <div className="space-y-3 p-4 border rounded-xl bg-muted/20 relative">
            {renderFieldFeedback("idCard")}
            <div className="flex items-center justify-between">
              <Label htmlFor="id-card" className="font-semibold flex items-center gap-2">
                1. สำเนาบัตรประชาชน {renderStatusBadge("idCard")}
              </Label>
            </div>
            
            <div 
              className={cn(
                "border-2 border-dashed rounded-lg p-4 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50",
                idCardPreview ? 'border-primary/50 bg-primary/5' : 'border-border',
                getFieldStatus("idCard") === "VERIFIED" && "opacity-60 cursor-not-allowed hover:bg-transparent"
              )}
              onClick={() => getFieldStatus("idCard") !== "VERIFIED" && document.getElementById('id-card-input')?.click()}
            >
              {idCardPreview ? (
                <div className="relative w-full">
                  <img src={idCardPreview} alt="ID Card Preview" className="w-full aspect-video object-contain rounded-md" />
                  <p className="mt-2 text-center text-xs text-primary">ไฟล์ที่เลือกไว้ รอกดอัปโหลด</p>
                </div>
              ) : submittedIdCardUrl ? (
                <div className="relative w-full">
                  <div className="relative">
                    <img
                      src={submittedIdCardUrl}
                      alt="Uploaded ID card"
                      className={cn(
                        "w-full aspect-video object-contain rounded-md",
                        getFieldStatus("idCard") === "VERIFIED" && "grayscale-[50%]",
                      )}
                    />
                    {getFieldStatus("idCard") === "VERIFIED" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
                        <ShieldCheck className="h-10 w-10 text-emerald-500" />
                      </div>
                    )}
                    </div>
                  <p className="mt-2 text-center text-xs text-muted-foreground">รูปที่อัปโหลดแล้ว</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground text-center">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง</p>
                </>
              )}
              <input 
                id="id-card-input" 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'idCard')}
                disabled={isPending || getFieldStatus("idCard") === "VERIFIED"}
              />
            </div>
            
            {getFieldStatus("idCard") !== "VERIFIED" && (
              <Button 
                size="sm" 
                className="w-full gap-2" 
                disabled={!idCardFile || (isPending && activeField === 'idCard')}
                onClick={() => handleSubmitField('idCard')}
              >
                {activeField === 'idCard' ? "กำลังอัปโหลด..." : "อัปโหลดบัตรประชาชน"}
              </Button>
            )}
          </div>

          {/* BANK BOOK SECTION */}
          <div className="space-y-3 p-4 border rounded-xl bg-muted/20">
            {renderFieldFeedback("bankBook")}
            <div className="flex items-center justify-between">
              <Label htmlFor="bank-book" className="font-semibold flex items-center gap-2">
                2. หน้าสมุดบัญชี {renderStatusBadge("bankBook")}
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank-account-number" className="text-xs text-muted-foreground">
                เลขบัญชีธนาคาร
              </Label>
              <Input
                id="bank-account-number"
                inputMode="numeric"
                placeholder="กรอกเลขบัญชีธนาคาร"
                value={bankAccountNumber}
                onChange={(event) =>
                  setBankAccountNumber(event.target.value.replace(/[^\d-]/g, ""))
                }
                disabled={isPending || getFieldStatus("bankBook") === "VERIFIED"}
              />
              {getFieldStatus("bankBook") === "VERIFIED" && bankAccountNumber && (
                <p className="text-xs text-muted-foreground">เลขบัญชีถูกล็อกหลังผ่านการตรวจสอบ</p>
              )}
            </div>
            
            <div 
              className={cn(
                "border-2 border-dashed rounded-lg p-4 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/50",
                bankBookPreview ? 'border-primary/50 bg-primary/5' : 'border-border',
                getFieldStatus("bankBook") === "VERIFIED" && "opacity-60 cursor-not-allowed hover:bg-transparent"
              )}
              onClick={() => getFieldStatus("bankBook") !== "VERIFIED" && document.getElementById('bank-book-input')?.click()}
            >
              {bankBookPreview ? (
                <div className="relative w-full">
                  <img src={bankBookPreview} alt="Bank Book Preview" className="w-full aspect-video object-contain rounded-md" />
                  <p className="mt-2 text-center text-xs text-primary">ไฟล์ที่เลือกไว้ รอกดอัปโหลด</p>
                </div>
              ) : submittedBankBookUrl ? (
                <div className="relative w-full">
                  <div className="relative">
                    <img
                      src={submittedBankBookUrl}
                      alt="Uploaded bank book"
                      className={cn(
                        "w-full aspect-video object-contain rounded-md",
                        getFieldStatus("bankBook") === "VERIFIED" && "grayscale-[50%]",
                      )}
                    />
                    {getFieldStatus("bankBook") === "VERIFIED" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
                        <ShieldCheck className="h-10 w-10 text-emerald-500" />
                      </div>
                    )}
                    </div>
                  <p className="mt-2 text-center text-xs text-muted-foreground">รูปที่อัปโหลดแล้ว</p>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="text-xs text-muted-foreground text-center">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง</p>
                </>
              )}
              <input 
                id="bank-book-input" 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'bankBook')}
                disabled={isPending || getFieldStatus("bankBook") === "VERIFIED"}
              />
            </div>

            {getFieldStatus("bankBook") !== "VERIFIED" && (
              <Button 
                size="sm" 
                className="w-full gap-2" 
                disabled={!bankBookFile || !bankAccountNumber.replace(/\D/g, "") || (isPending && activeField === 'bankBook')}
                onClick={() => handleSubmitField('bankBook')}
              >
                {activeField === 'bankBook' ? "กำลังอัปโหลด..." : "อัปโหลดสมุดบัญชี"}
              </Button>
            )}
          </div>

          {/* ADDRESS SECTION */}
          <div className="space-y-3 p-4 border rounded-xl bg-muted/20">
            {renderFieldFeedback("address")}
            <Label htmlFor="address" className="font-semibold flex items-center gap-2">
              3. ที่อยู่สำหรับส่งเอกสาร (50 ทวิ) {renderStatusBadge("address")}
            </Label>
            <textarea 
              id="address"
              placeholder="กรอกที่อยู่ปัจจุบันของคุณอย่างละเอียด..."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={isPending || getFieldStatus("address") === "VERIFIED"}
            />
            
            {getFieldStatus("address") !== "VERIFIED" && (
              <Button 
                size="sm" 
                className="w-full gap-2" 
                disabled={!address.trim() || address === user?.settings?.address || (isPending && activeField === 'address')}
                onClick={() => handleSubmitField('address')}
              >
                {activeField === 'address' ? "กำลังบันทึก..." : "บันทึกที่อยู่"}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={isPending}>
            ปิดหน้าต่าง
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
