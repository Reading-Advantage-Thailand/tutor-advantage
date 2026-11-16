"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  BookOpen,
  Calendar,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  IdCard,
  LifeBuoy,
  Lock,
  LogOut,
  MessageCircle,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Users,
  Volume2,
} from "lucide-react";
import {
  Chip,
  ConfirmSheet,
  IconTile,
  LevelChip,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  SegmentedControl,
  type SegmentedControlItem,
  Skeleton,
  SwitchRow,
} from "@/components/mobile";
import { useLiff, type LiffProfile } from "@/components/providers/LiffProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { useCachedResource } from "@/lib/cachedResource";
import { formatLevelLabel, getPrimaryClass, type DashboardSummary } from "@/lib/enrollmentStatus";
import { t } from "@/lib/i18n";
import { keepThaiWords } from "@/lib/thaiText";
import { dashboardResourceKey, fetchDashboardSummary } from "@/lib/resourceKeys";
import { copyTextToClipboard } from "../dashboard/_components/clipboard";
import { businessContact } from "@/lib/businessContact";
import { LiffErrorState } from "../dashboard/_components/LiffErrorState";
import { ProfileHero } from "./_components/ProfileHero";
import { ProfileSkeleton } from "./_components/ProfileSkeleton";
import { useNotificationSound } from "./_components/useNotificationSound";

type ThemeChoice = "light" | "dark" | "system";

/** Thai text: keeps the phrase after the last space on one line ("ไว้ส่งให้ทีมงาน", never "ทีม / งาน"). */
function NoBreakTail({ text }: { text: string }) {
  const cut = text.lastIndexOf(" ");
  if (cut <= 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, cut)} <span className="whitespace-nowrap">{text.slice(cut + 1)}</span>
    </>
  );
}

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
        <div className="px-4 pt-2 pb-6">
          <LiffErrorState card />
        </div>
      </Screen>
    );
  }

  const name = profile.displayName || t("dashboard.defaultName");
  // Same featured class as Home (live → first paid), never a fake default level.
  const primaryClass = getPrimaryClass(summary);
  const levelLabel = formatLevelLabel(primaryClass);
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

  // ThemeSegmented (components.md §8): icon + word; the icons show only when a
  // segment has room, so "ตามระบบ" never truncates.
  const themeItems: SegmentedControlItem<ThemeChoice>[] = [
    { value: "light", label: t("profile.themeLight"), icon: Sun },
    { value: "dark", label: t("profile.themeDark"), icon: Moon },
    { value: "system", label: t("profile.themeSystem"), icon: Monitor },
  ];

  // Chips on the hero: the CEFR level keeps its band colour (with a hero ring);
  // a book without a level uses the paper chip.
  const level = levelLoading ? (
    <Skeleton className="h-8 w-40 rounded-full" />
  ) : levelLabel ? (
    primaryClass?.seriesCefr ? (
      <LevelChip cefr={primaryClass.seriesCefr} size="md" className="ring-[1.5px] ring-hero-ring">
        {levelLabel}
      </LevelChip>
    ) : (
      <Chip tone="paper" size="md" icon={BookOpen}>
        {levelLabel}
      </Chip>
    )
  ) : null;

  return (
    <Screen>
      <ProfileHero name={name} pictureUrl={profile.pictureUrl} level={level} />

      <div className="flex flex-col gap-6 px-4 pt-5 pb-6">
        {/* Phones and small tablets: one column. ≥ 768 (the full app column): two columns of groups. */}
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <ListGroup header={t("profile.learning")}>
              <ListRow href="/classes" leading={<IconTile icon={BookOpen} tone="brand" size="sm" />} title={t("profile.myClasses")} />
              <ListRow
                href="/payment/history"
                leading={<IconTile icon={CreditCard} tone="amber" size="sm" />}
                title={t("profile.paymentHistory")}
              />
              <ListRow href="/schedule" leading={<IconTile icon={Calendar} tone="purple" size="sm" />} title={t("profile.schedule")} />
            </ListGroup>

            <ListGroup header={t("profile.account")}>
              <ListRow href="/guardian" leading={<IconTile icon={Users} tone="teal" size="sm" />} title={t("profile.guardian")} />
              <ListRow href="/consent" leading={<IconTile icon={ShieldCheck} tone="teal" size="sm" />} title={t("profile.consent")} />
              <ListRow
                onClick={() => void copyUserId()}
                leading={<IconTile icon={IdCard} tone="neutral" size="sm" />}
                title={
                  <span className="flex flex-wrap items-center gap-x-2">
                    {t("profile.userId")}
                    <span className="rounded-full bg-surface-muted px-2 font-mono text-xs leading-[1.6] font-normal text-fg-muted">
                      {shortUserId}
                    </span>
                  </span>
                }
                subtitle={<NoBreakTail text={t("profile.userIdSub")} />}
                trailing={<Copy aria-hidden="true" className="size-5 text-fg-subtle" />}
              />
            </ListGroup>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <ListGroup header={t("profile.appSettings")}>
              <ListRow href="/notifications" leading={<IconTile icon={Bell} tone="pink" size="sm" />} title={t("profile.notifications")} />
              <SwitchRow
                leading={<IconTile icon={Volume2} tone="pink" size="sm" />}
                title={t("profile.notificationSound")}
                subtitle={<span className="block text-balance">{keepThaiWords(t("profile.notificationSoundSub"))}</span>}
                checked={soundOn}
                onCheckedChange={(checked) => setSoundOn(checked)}
              />
              <div className="list-row px-4 pt-3 pb-4" data-leading="">
                <div className="flex min-h-10 items-center gap-3.5">
                  <IconTile icon={Palette} tone="orange" size="sm" />
                  <span className="text-base leading-[1.5] font-semibold text-fg">{t("profile.theme")}</span>
                </div>
                <SegmentedControl<ThemeChoice>
                  items={themeItems}
                  value={theme}
                  onChange={setTheme}
                  aria-label={t("profile.themeAria")}
                  size="compact"
                  // 8px wider than the row text, so "ตามระบบ" fits whole at 320.
                  className="-mx-2 mt-3 w-[calc(100%+16px)]"
                />
              </div>
            </ListGroup>

            <ListGroup header={t("profile.help")}>
              <ListRow
                href="/support"
                leading={<IconTile icon={LifeBuoy} tone="blue" size="sm" />}
                title={t("profile.myRequests")}
                subtitle={<span className="block text-balance">{t("profile.myRequestsSub")}</span>}
              />
              <ListRow
                href={businessContact.lineUrl}
                chevron={false}
                leading={<IconTile icon={MessageCircle} tone="blue" size="sm" />}
                title={t("profile.contactTeam")}
                subtitle={<span className="block text-balance">{t("profile.contactTeamSub")}</span>}
                trailing={<ExternalLink aria-hidden="true" className="size-5 text-fg-subtle" />}
              />
              <ListRow href="/terms" leading={<IconTile icon={FileText} tone="neutral" size="sm" />} title={t("profile.terms")} />
              <ListRow href="/privacy" leading={<IconTile icon={Lock} tone="neutral" size="sm" />} title={t("profile.privacy")} />
            </ListGroup>
          </div>
        </div>

        {/* The destructive action stands apart: a danger ghost, not a row among the links. */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <Button
            variant="ghost"
            size="touch"
            className="w-full max-w-[360px] text-danger-fg hover:text-danger-fg"
            onClick={() => setConfirmLogout(true)}
          >
            <LogOut aria-hidden="true" />
            {t("profile.logout")}
          </Button>
          <p className="text-center text-xs leading-[1.6] text-fg-muted">
            {t("profile.footer")}
            <br />
            {t("profile.compliance")}
          </p>
        </div>
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
