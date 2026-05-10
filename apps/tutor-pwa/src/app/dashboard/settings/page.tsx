import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  MapPin, 
  ShieldCheck, 
  ChevronRight, 
  Bell, 
  Wallet,
  FileText
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { SettingsInteractiveElements, EditableSettingToggle, EditableSettingText } from "./client-components";

async function getUserProfile(token: string) {
  const res = await fetch("http://localhost:3001/v1/users/me", {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const response = await getUserProfile(token);
  const user = response?.user || { displayName: "Tutor User", userId: "TA-99999", role: "TUTOR" };

  return (
    <div className="max-w-2xl mx-auto space-y-6 lg:space-y-8 pb-24 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ตั้งค่าบัญชี</h1>
        <p className="text-sm text-muted-foreground mt-1">
          จัดการข้อมูลส่วนตัว ความเป็นส่วนตัว และบัญชีรับเงิน
        </p>
      </div>

      {/* Profile Summary Card */}
      <Card className="border-border/60 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <CardContent className="p-6 relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-4 border-background shadow-sm shrink-0 overflow-hidden relative">
            {user.profilePictureUrl ? (
              <Image 
                src={user.profilePictureUrl} 
                alt={user.displayName || "Profile"} 
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold text-foreground">{user.displayName || "Unknown User"}</h2>
            <p className="text-sm text-muted-foreground mb-3 truncate max-w-xs">{user.userId}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Badge variant="secondary" className="font-normal text-xs bg-primary/10 text-primary hover:bg-primary/20">
                <ShieldCheck className="w-3 h-3 mr-1" /> ยืนยันตัวตนแล้ว
              </Badge>
              <Badge variant="outline" className="font-normal text-xs uppercase">
                ระดับ: {user.role?.replace("ROLE_", "") || "TUTOR"}
              </Badge>
            </div>
          </div>
          {/* Action buttons embedded in SettingsInteractiveElements (Not Implemented Yet) */}
          {/*<SettingsInteractiveElements type="editProfileButton" />*/}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
          ระบบและการแจ้งเตือน
        </h3>
        
        <Card className="border-border/60">
          <div className="divide-y divide-border/50">
            <SettingsInteractiveElements type="themeToggleRow" />
            <SettingsInteractiveElements type="soundToggleRow" />

            <EditableSettingToggle 
              title="การแจ้งเตือนบน LINE"
              description="รับข้อความเมื่อมีนักเรียนชำระเงิน"
              iconName="Bell"
              value={user.settings?.lineNotification}
              settingKey="lineNotification"
              iconBgClass="bg-orange-500/10"
              iconColorClass="text-orange-500"
            />
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
          ข้อมูลบัญชีและการเงิน
        </h3>
        
        <Card className="border-border/60">
          <div className="divide-y divide-border/50">
            <EditableSettingText 
              title="เป้าหมายคอมมิชชั่น (THB)"
              description="ระบุเพื่อปรับหลอดเป้าหมายในหน้า Dashboard"
              placeholder="เช่น 50000"
              iconName="TrendingUp"
              value={user.settings?.commissionGoal}
              settingKey="commissionGoal"
              iconBgClass="bg-amber-500/10"
              iconColorClass="text-amber-500"
            />
            
            <EditableSettingText 
              title="บัญชีรับเงิน (PromptPay)"
              description="ยังไม่ได้ระบุ"
              placeholder="ระบุหมายเลขพร้อมเพย์ของคุณ"
              iconName="Wallet"
              value={user.settings?.promptPay}
              settingKey="promptPay"
              iconBgClass="bg-emerald-500/10"
              iconColorClass="text-emerald-600 dark:text-emerald-400"
            />
            
            <EditableSettingText 
              title="ที่อยู่สำหรับส่งเอกสาร (ภ.ง.ด.3)"
              description="ยังไม่ได้ระบุ"
              placeholder="ระบุที่อยู่พร้อมรหัสไปรษณีย์"
              iconName="MapPin"
              value={user.settings?.address}
              settingKey="address"
              iconBgClass="bg-blue-500/10"
              iconColorClass="text-blue-500"
            />
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
          นโยบายและข้อตกลง (PDPA)
        </h3>
        
        <Card className="border-border/60">
          <div className="divide-y divide-border/50">
            <Link href="/terms" className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">ข้อตกลงการให้บริการ</p>
                  <p className="text-xs text-muted-foreground">อ่านข้อควรปฏิบัติของ Tutor Advantage</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
            </Link>
            
            <Link href="/privacy" className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">นโยบายความเป็นส่วนตัว</p>
                  <p className="text-xs text-muted-foreground">เรียนรู้การจัดการข้อมูลส่วนบุคคลของคุณ</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
            </Link>
          </div>
        </Card>
      </div>

      <SettingsInteractiveElements type="logoutSection" />
    </div>
  );
}
