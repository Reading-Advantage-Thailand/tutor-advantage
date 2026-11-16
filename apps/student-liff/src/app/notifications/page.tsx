"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Megaphone, MessageSquare, Trophy, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { AppBar, ErrorState, IconTile, ListGroup, Notice, Screen, SwitchRow } from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { LiffErrorState } from "@/app/dashboard/_components/LiffErrorState";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { noOrphan } from "@/lib/format";
import { t } from "@/lib/i18n";
import { keepThaiWords, thaiCopy } from "@/lib/thaiText";
import { isNotificationSoundMuted, playNotificationSound, setNotificationSoundMuted } from "@/lib/sounds";
import { NotificationsSkeleton } from "./_components/NotificationsSkeleton";
import {
  createAutoSaver,
  isLineConnected,
  resolveNotificationSettings,
  withNotificationSettings,
  type NotificationSettings,
  type NotificationToggleKey,
  type SettingsResponse,
} from "./_lib/settings";

/** One toast at a time for quick successive toggles. */
const TOAST_ID = "notification-settings";

const LEARNING_TOGGLES: Array<{
  key: NotificationToggleKey;
  icon: typeof BookOpen;
  tone: "purple" | "orange" | "blue";
  title: Parameters<typeof t>[0];
  subtitle: Parameters<typeof t>[0];
}> = [
  {
    key: "notifyClassReminders",
    icon: BookOpen,
    tone: "purple",
    title: "notifications.classReminder",
    subtitle: "notifications.classReminderDescription",
  },
  {
    key: "notifyScoreUpdates",
    icon: Trophy,
    tone: "orange",
    title: "notifications.scoreSummary",
    subtitle: "notifications.scoreSummaryDescription",
  },
  {
    key: "notifyLineMessages",
    icon: MessageSquare,
    tone: "blue",
    title: "notifications.lineMessages",
    subtitle: "notifications.lineMessagesDescription",
  },
];

/**
 * Thai row text on narrow phones: balanced lines, and a short last word stays
 * with the one before it ("15 นาที" never splits) and listed phrases stay
 * whole ("และรางวัล", "คอร์สเรียนใหม่"). The row sets 1.6 between wrapped lines.
 */
function RowText({ text }: { text: string }) {
  return <span className="block text-balance">{keepThaiWords(noOrphan(text, 4))}</span>;
}

export default function NotificationsPage() {
  const { isReady, profile, error: liffError } = useLiff();
  const userId = profile?.userId;
  const { data, error, isLoading, isValidating, refetch, mutate } = useCachedResource<SettingsResponse>(
    userId ? `${userId}:notificationSettings` : null,
    () => studentApi.getSettings(),
    { enabled: isReady },
  );

  // Each toggle saves itself right away (PATCH the whole notifications object,
  // one request at a time); the cache holds what is on screen.
  const saver = useMemo(
    () =>
      createAutoSaver<NotificationSettings>({
        save: (notifications) => studentApi.updateSettings({ notifications }),
        onChange: (notifications) => mutate((current) => withNotificationSettings(current, notifications)),
        onSaved: () => toast.success(t("notifications.saved"), { id: TOAST_ID }),
        onError: (err) => {
          console.warn("Failed to save settings:", err);
          toast.error(t("notifications.saveFailed"), { id: TOAST_ID });
        },
      }),
    [mutate],
  );

  // Device-only sound setting (localStorage); read after mount to match SSR.
  const [soundOn, setSoundOn] = useState<boolean | null>(null);
  useEffect(() => {
    setSoundOn(!isNotificationSoundMuted());
  }, []);

  const toggleSound = (on: boolean) => {
    setNotificationSoundMuted(!on);
    setSoundOn(on);
    if (on) playNotificationSound(); // let them hear what they turned on
    toast.success(t("notifications.saved"), { id: TOAST_ID });
  };

  if (!isReady || isLoading) return <NotificationsSkeleton />;

  if (liffError || !profile) {
    return (
      <Screen>
        <AppBar title={t("notifications.title")} back fallbackHref="/profile" />
        <div className="px-4 pt-2 pb-6">
          <LiffErrorState card />
        </div>
      </Screen>
    );
  }

  const loadFailed = Boolean(error) && !data;
  const settings = resolveNotificationSettings(data);
  const lineConnected = isLineConnected(data);

  return (
    <Screen>
      <AppBar title={t("notifications.title")} back fallbackHref="/profile" />

      <div className="flex flex-col gap-6 px-4 pt-2 pb-[calc(24px+var(--safe-bottom))]">
        <p className="px-1 text-[15px] leading-[1.65] text-balance text-fg-muted">{t("notifications.subtitle")}</p>

        {/* LINE status: tone + icon + words (never colour alone). */}
        {loadFailed ? null : (
          <Notice
            tone={lineConnected ? "success" : "warning"}
            title={lineConnected ? t("notifications.lineConnected") : t("notifications.lineNotConnected")}
            description={
              <span className="block text-balance">
                {thaiCopy(lineConnected ? t("notifications.linePush") : t("notifications.lineNotConnectedDescription"))}
              </span>
            }
          />
        )}

        {/* What this screen is for comes first: the account toggles; the device-only sound last. */}
        {loadFailed ? (
          <ErrorState
            card
            description={t("notifications.loadFailed")}
            onRetry={() => void refetch()}
            retrying={isValidating}
            className="py-8"
          />
        ) : (
          <>
            <ListGroup header={t("notifications.learningChannel")}>
              {LEARNING_TOGGLES.map((toggle) => (
                <SwitchRow
                  key={toggle.key}
                  leading={<IconTile icon={toggle.icon} tone={toggle.tone} size="sm" />}
                  title={<RowText text={t(toggle.title)} />}
                  subtitle={<RowText text={t(toggle.subtitle)} />}
                  checked={Boolean(settings[toggle.key])}
                  onCheckedChange={(checked) => void saver.set(settings, toggle.key, checked)}
                />
              ))}
            </ListGroup>

            <ListGroup header={t("notifications.marketingNews")} footer={t("notifications.autoSaveHint")}>
              <SwitchRow
                leading={<IconTile icon={Megaphone} tone="amber" size="sm" />}
                title={<RowText text={t("notifications.offers")} />}
                subtitle={<RowText text={t("notifications.offersDescription")} />}
                checked={Boolean(settings.notifyMarketing)}
                onCheckedChange={(checked) => void saver.set(settings, "notifyMarketing", checked)}
              />
            </ListGroup>
          </>
        )}

        <ListGroup header={t("notifications.soundSettings")} footer={t("notifications.soundHint")}>
          <SwitchRow
            leading={<IconTile icon={soundOn === false ? VolumeX : Volume2} tone="pink" size="sm" />}
            title={<RowText text={t("notifications.appSound")} />}
            subtitle={<RowText text={t("notifications.appSoundDescription")} />}
            checked={soundOn ?? true}
            disabled={soundOn === null}
            onCheckedChange={(checked) => toggleSound(checked)}
          />
        </ListGroup>
      </div>
    </Screen>
  );
}
