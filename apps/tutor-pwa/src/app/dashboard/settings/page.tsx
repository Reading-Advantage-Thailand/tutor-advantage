import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  ShieldCheck,
  ChevronRight,
  Bell,
  FileText,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { IDENTITY_URL } from "@/lib/service-urls";
import {
  SettingsInteractiveElements,
  EditableSettingToggle,
  VerificationRow,
} from "./client-components";
import { PageTransition } from "@/components/ui/page-transition";
import { t } from "@/lib/i18n";

async function getUserProfile(token: string) {
  const res = await fetch(`${IDENTITY_URL}/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const response = await getUserProfile(token);
  const user = response?.user || {
    displayName: "Tutor User",
    userId: "TA-99999",
    role: "TUTOR",
  };

  return (
    <PageTransition variant="slide-up" stagger className="max-w-2xl mx-auto space-y-6 lg:space-y-8 pb-28 sm:pb-12">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-black tracking-tight text-foreground">{t("dashboardSettings.title")}</h1>
        <p className="text-sm font-medium text-muted-foreground mt-1.5">
          {t("dashboardSettings.subtitle")}
        </p>
      </div>

      {/* Profile Summary Card */}
      <Card className="border border-border/40 hover:shadow-lg rounded-3xl shadow-sm bg-card bg-gradient-to-br from-card via-card to-brand-500/2 dark:to-brand-500/5 transition-all duration-300 overflow-hidden relative group animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="absolute top-0 right-0 w-36 h-36 bg-brand-500/10 dark:bg-brand-500/5 rounded-full blur-3xl -mr-8 -mt-8 pointer-events-none" />
        <CardContent className="p-6 sm:p-7 relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-brand-400 to-brand-600 p-[3px] shadow-md shadow-brand-500/10 shrink-0 relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
            <div className="w-full h-full rounded-full bg-muted flex items-center justify-center border-2 border-background overflow-hidden relative">
              {user.profilePictureUrl ? (
                <Image
                  src={user.profilePictureUrl}
                  alt={user.displayName || "Profile"}
                  fill
                  priority
                  sizes="80px"
                  referrerPolicy="no-referrer"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <User className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-foreground group-hover:text-brand-500 transition-colors">
              {user.displayName || t("dashboardSettings.unknownUser")}
            </h2>
            <p className="text-xs font-semibold text-muted-foreground/80 mt-1 mb-3.5 font-mono select-all bg-muted/65 py-0.5 px-2 rounded-md inline-block max-w-xs truncate border border-border/40">
              {user.userId}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Badge
                variant="secondary"
                className={`font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider border shrink-0 ${
                  user.verificationStatus === "VERIFIED"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : user.verificationStatus === "PENDING"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : user.verificationStatus === "REJECTED"
                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                        : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1 shrink-0" />
                {user.verificationStatus === "VERIFIED"
                  ? t("dashboardSettings.verified")
                  : user.verificationStatus === "PENDING"
                    ? t("dashboardSettings.pending")
                    : user.verificationStatus === "REJECTED"
                      ? t("dashboardSettings.rejected")
                      : t("dashboardSettings.unverified")}
              </Badge>
              <Badge
                variant="outline"
                className="font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-border/60 shrink-0"
              >
                {t("dashboardSettings.rolePrefix")} {user.role?.replace("ROLE_", "") || "TUTOR"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
        <h3 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2.5">
          {t("dashboardSettings.systemSection")}
        </h3>

        <Card className="border border-border/40 hover:shadow-md rounded-3xl shadow-sm bg-card overflow-hidden transition-all duration-300 relative border-l-4 border-l-brand-500">
          <div className="divide-y divide-border/30">
            <SettingsInteractiveElements type="themeToggleRow" />
            <SettingsInteractiveElements type="soundToggleRow" />

            <EditableSettingToggle
              title={t("dashboardSettings.lineNotificationTitle")}
              description={t("dashboardSettings.lineNotificationDescription")}
              iconName="Bell"
              value={user.settings?.lineNotification}
              settingKey="lineNotification"
              iconBgClass="bg-orange-500/10"
              iconColorClass="text-orange-500"
            />
          </div>
        </Card>
      </div>

      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '150ms' }}>
        <h3 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2.5">
          {t("dashboardSettings.financeSection")}
        </h3>

        <Card className="border border-border/40 hover:shadow-md rounded-3xl shadow-sm bg-card overflow-hidden transition-all duration-300 relative border-l-4 border-l-brand-500">
          <div className="divide-y divide-border/30">
            <VerificationRow user={user} />
          </div>
        </Card>
      </div>

      <div className="space-y-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <h3 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest px-2.5">
          {t("dashboardSettings.policySection")}
        </h3>

        <Card className="border border-border/40 hover:shadow-md rounded-3xl shadow-sm bg-card overflow-hidden transition-all duration-300 relative border-l-4 border-l-brand-500">
          <div className="divide-y divide-border/30">
            <Link
              href="/terms"
              className="flex items-center justify-between p-4 sm:p-5 hover:bg-brand-500/2 dark:hover:bg-brand-500/4 transition-colors group relative"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-brand-500 transition-all duration-300" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground group-hover:text-brand-500 transition-colors">
                    {t("dashboardSettings.termsTitle")}
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground/75 mt-0.5">
                    {t("dashboardSettings.termsDescription")}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-foreground transition-colors group-hover:translate-x-1 duration-300" />
            </Link>

            <Link
              href="/privacy"
              className="flex items-center justify-between p-4 sm:p-5 hover:bg-brand-500/2 dark:hover:bg-brand-500/4 transition-colors group relative"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-brand-500 transition-all duration-300" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <ShieldCheck className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground group-hover:text-brand-500 transition-colors">
                    {t("dashboardSettings.privacyTitle")}
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground/75 mt-0.5">
                    {t("dashboardSettings.privacyDescription")}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-foreground transition-colors group-hover:translate-x-1 duration-300" />
            </Link>
          </div>
        </Card>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: '250ms' }}>
        <SettingsInteractiveElements type="logoutSection" />
      </div>
    </PageTransition>
  );
}
