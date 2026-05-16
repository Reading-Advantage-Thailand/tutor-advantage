import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  MapPin,
  ShieldCheck,
  ChevronRight,
  Bell,
  Wallet,
  FileText,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import {
  SettingsInteractiveElements,
  EditableSettingToggle,
  EditableSettingText,
  VerificationRow,
} from "./client-components";
import VerificationBanner from "@/components/dashboard/verification-banner";
import { t } from "@/lib/i18n";

async function getUserProfile(token: string) {
  const res = await fetch("http://localhost:3001/v1/users/me", {
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
    <div className="max-w-2xl mx-auto space-y-6 lg:space-y-8 pb-24 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("dashboardSettings.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboardSettings.subtitle")}
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
            <h2 className="text-xl font-bold text-foreground">
              {user.displayName || t("dashboardSettings.unknownUser")}
            </h2>
            <p className="text-sm text-muted-foreground mb-3 truncate max-w-xs">
              {user.userId}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Badge
                variant="secondary"
                className={`font-normal text-xs ${
                  user.verificationStatus === "VERIFIED"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : user.verificationStatus === "PENDING"
                      ? "bg-amber-500/10 text-amber-600"
                      : user.verificationStatus === "REJECTED"
                        ? "bg-red-500/10 text-red-600"
                        : "bg-slate-500/10 text-slate-600"
                }`}
              >
                <ShieldCheck className="w-3 h-3 mr-1" />
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
                className="font-normal text-xs uppercase"
              >
                {t("dashboardSettings.rolePrefix")} {user.role?.replace("ROLE_", "") || "TUTOR"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
          {t("dashboardSettings.systemSection")}
        </h3>

        <Card className="border-border/60">
          <div className="divide-y divide-border/50">
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

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
          {t("dashboardSettings.financeSection")}
        </h3>

        <Card className="border-border/60">
          <div className="divide-y divide-border/50">
            {user.verificationStatus !== "VERIFIED" ? (
              <VerificationRow user={user} />
            ) : (
              <EditableSettingText
                title={t("dashboardSettings.bankAccountTitle")}
                description={t("dashboardSettings.notSpecified")}
                placeholder={t("dashboardSettings.bankAccountPlaceholder")}
                iconName="Wallet"
                value={user.settings?.promptPay}
                settingKey="promptPay"
                iconBgClass="bg-emerald-500/10"
                iconColorClass="text-emerald-600 dark:text-emerald-400"
              />
            )}

            <EditableSettingText
              title={t("dashboardSettings.taxAddressTitle")}
              description={t("dashboardSettings.notSpecified")}
              placeholder={t("dashboardSettings.taxAddressPlaceholder")}
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
          {t("dashboardSettings.policySection")}
        </h3>

        <Card className="border-border/60">
          <div className="divide-y divide-border/50">
            <Link
              href="/terms"
              className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("dashboardSettings.termsTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboardSettings.termsDescription")}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
            </Link>

            <Link
              href="/privacy"
              className="flex items-center justify-between p-4 sm:p-5 hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("dashboardSettings.privacyTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboardSettings.privacyDescription")}
                  </p>
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
