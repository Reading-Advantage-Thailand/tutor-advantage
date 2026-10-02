"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  BookOpen,
  Calendar,
  CreditCard,
  ExternalLink,
  FileText,
  IdCard,
  Lock,
  LogOut,
  MessageCircle,
  Palette,
  ShieldCheck,
  Users,
  Volume2,
} from "lucide-react";
import {
  Chip,
  ConfirmSheet,
  IconTile,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  SegmentedControl,
  Skeleton,
  Surface,
  SwitchRow,
  UserAvatar,
} from "@/components/mobile";
import { useLiff, type LiffProfile } from "@/components/providers/LiffProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useCachedResource } from "@/lib/cachedResource";
import { formatLevelLabel, getPrimaryClass, type DashboardSummary } from "@/lib/enrollmentStatus";
import { t } from "@/lib/i18n";
import { dashboardResourceKey, fetchDashboardSummary } from "@/lib/resourceKeys";
import { copyTextToClipboard } from "../dashboard/_components/clipboard";
import { LiffErrorState } from "../dashboard/_components/LiffErrorState";
import { ProfileSkeleton } from "./_components/ProfileSkeleton";
import { useNotificationSound } from "./_components/useNotificationSound";

type ThemeChoice = "light" | "dark" | "system";

const LINE_OA_URL = "https://lin.ee/R7Dccj9";

export default function ProfilePage() {
  const { isReady, profile: liffProfile, logout } = useLiff();
  const { theme, setTheme } = useTheme();
  const [soundOn, setSoundOn] = useNotificationSound();
  const [confirmLogout, setConfirmLogout] = useState(false);
  // logout() sets the LIFF profile to null right away, then hard-navigates to
  // /login. Keep showing this page (sheet in its loading state) until the
  // browser leaves, instead of flashing the "log in again" error screen.
  const [loggingOutAs, setLoggingOutAs] = useState<LiffProfile | null>(null);
  const loggingOut = loggingOutAs !== null;
  const profile = liffProfile ?? loggingOutAs;

  // Level/book comes from Home's cached summary. Fetch it (same key, same
  // fetcher) only when it is not cached yet; never revalidate it from here.
  // Keyed on the live LIFF profile so nothing is fetched while logging out.
  const { data: summary, isLoading: levelLoading } = useCachedResource<DashboardSummary>(
    liffProfile ? dashboardResourceKey(liffProfile.userId) : null,
    fetchDashboardSummary,
    { enabled: isReady, staleTime: Number.POSITIVE_INFINITY, revalidateOnFocus: false },
  );

  if (!isReady) return <ProfileSkeleton />;

  if (!profile) {
    return (
      <Screen>
        <PageHeader title={t("profile.title")} />
        <LiffErrorState className="flex-1 justify-center" />
      </Screen>
    );
  }

  const name = profile.displayName || t("dashboard.defaultName");
  // Same featured class as Home (live → first paid), never a fake default level.
  const levelLabel = formatLevelLabel(getPrimaryClass(summary));
  const shortUserId = profile.userId.length > 10 ? `${profile.userId.slice(0, 8)}…` : profile.userId;

  const copyUserId = async () => {
    try {
      await copyTextToClipboard(profile.userId);
      toast.success(t("profile.userIdCopied"));
    } catch {
      toast.error(t("dashboard.copyFailed"));
    }
  };

  const confirmAndLogout = () => {
    if (loggingOut) return;
    setLoggingOutAs(profile);
    // Clears the session probe, cached data, cookie and LINE login, then hard-navigates to /login.
    logout();
  };

  const themeItems: { value: ThemeChoice; label: string }[] = [
    { value: "light", label: t("profile.themeLight") },
    { value: "dark", label: t("profile.themeDark") },
    { value: "system", label: t("profile.themeSystem") },
  ];

  return (
    <Screen>
      <PageHeader title={t("profile.title")} />

      <div className="flex flex-col gap-6 px-4 pb-6">
        <Surface padding="lg" className="flex items-center gap-4">
          <UserAvatar src={profile.pictureUrl} name={name} size="xl" decorative />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl leading-[1.4] font-extrabold text-fg">{name}</h2>
            {levelLoading ? (
              <Skeleton className="mt-2 h-[30px] w-40 rounded-full" />
            ) : levelLabel ? (
              <Chip tone="brand" size="md" icon={BookOpen} className="mt-2">
                {levelLabel}
              </Chip>
            ) : null}
          </div>
        </Surface>

        <ListGroup header={t("profile.learning")}>
          <ListRow href="/classes" leading={<IconTile icon={BookOpen} tone="brand" />} title={t("profile.myClasses")} />
          <ListRow
            href="/payment/history"
            leading={<IconTile icon={CreditCard} tone="brand" />}
            title={t("profile.paymentHistory")}
          />
          <ListRow href="/schedule" leading={<IconTile icon={Calendar} tone="brand" />} title={t("profile.schedule")} />
        </ListGroup>

        <ListGroup header={t("profile.appSettings")}>
          <div className="list-row px-4 py-3" data-leading="">
            <div className="flex items-center gap-3">
              <IconTile icon={Palette} tone="amber" />
              <span className="text-[15px] leading-[1.5] font-semibold text-fg">
                {t("profile.theme")}
              </span>
            </div>
            <SegmentedControl<ThemeChoice>
              items={themeItems}
              value={theme}
              onChange={setTheme}
              aria-label={t("profile.themeAria")}
              className="mt-3"
            />
          </div>
          <SwitchRow
            leading={<IconTile icon={Volume2} tone="amber" />}
            title={t("profile.notificationSound")}
            subtitle={t("profile.notificationSoundSub")}
            checked={soundOn}
            onCheckedChange={(checked) => setSoundOn(checked)}
          />
        </ListGroup>

        <ListGroup header={t("profile.account")}>
          <ListRow href="/notifications" leading={<IconTile icon={Bell} tone="blue" />} title={t("profile.notifications")} />
          <ListRow href="/consent" leading={<IconTile icon={ShieldCheck} tone="blue" />} title={t("profile.consent")} />
          <ListRow href="/guardian" leading={<IconTile icon={Users} tone="blue" />} title={t("profile.guardian")} />
        </ListGroup>

        <ListGroup header={t("profile.help")}>
          <ListRow
            href={LINE_OA_URL}
            chevron={false}
            leading={<IconTile icon={MessageCircle} tone="neutral" />}
            title={t("profile.contactTeam")}
            subtitle={t("profile.contactTeamSub")}
            trailing={<ExternalLink aria-hidden="true" className="size-4 text-fg-subtle" />}
          />
          <ListRow href="/terms" leading={<IconTile icon={FileText} tone="neutral" />} title={t("profile.terms")} />
          <ListRow href="/privacy" leading={<IconTile icon={Lock} tone="neutral" />} title={t("profile.privacy")} />
          <ListRow
            onClick={() => void copyUserId()}
            leading={<IconTile icon={IdCard} tone="neutral" />}
            title={t("profile.userId")}
            subtitle={t("profile.userIdSub")}
            trailing={<span className="font-mono text-xs">{shortUserId}</span>}
          />
        </ListGroup>

        <ListGroup>
          <ListRow
            onClick={() => setConfirmLogout(true)}
            leading={<IconTile icon={LogOut} tone="red" />}
            title={t("profile.logout")}
            destructive
          />
        </ListGroup>

        <p className="px-4 text-center text-xs leading-[1.6] text-fg-muted">
          {t("profile.footer")}
          <br />
          {t("profile.compliance")}
        </p>
      </div>

      <ConfirmSheet
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title={t("profile.logoutConfirmTitle")}
        description={t("profile.logoutConfirmDescription")}
        confirmLabel={t("profile.logout")}
        tone="danger"
        loading={loggingOut}
        onConfirm={confirmAndLogout}
      />
    </Screen>
  );
}
