"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Megaphone, MessageSquare, Trophy, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { AppBar, ErrorState, IconTile, ListGroup, Notice, Screen, SwitchRow } from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { LiffErrorState } from "@/app/dashboard/_components/LiffErrorState";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
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
        <LiffErrorState />
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
        <p className="px-1 text-sm leading-[1.6] text-fg-muted">{t("notifications.subtitle")}</p>

        {loadFailed ? null : (
          <Notice
            tone={lineConnected ? "success" : "warning"}
            title={lineConnected ? t("notifications.lineConnected") : t("notifications.lineNotConnected")}
            description={lineConnected ? t("notifications.linePush") : t("notifications.lineNotConnectedDescription")}
          />
        )}

        <ListGroup header={t("notifications.soundSettings")} footer={t("notifications.soundHint")}>
          <SwitchRow
            leading={<IconTile icon={soundOn === false ? VolumeX : Volume2} tone="pink" />}
            title={t("notifications.appSound")}
            subtitle={t("notifications.appSoundDescription")}
            checked={soundOn ?? true}
            disabled={soundOn === null}
            onCheckedChange={(checked) => toggleSound(checked)}
          />
        </ListGroup>

        {loadFailed ? (
          <ErrorState
            description={t("notifications.loadFailed")}
            onRetry={() => void refetch()}
            retrying={isValidating}
            className="py-6"
          />
        ) : (
          <>
            <ListGroup header={t("notifications.learningChannel")}>
              {LEARNING_TOGGLES.map((toggle) => (
                <SwitchRow
                  key={toggle.key}
                  leading={<IconTile icon={toggle.icon} tone={toggle.tone} />}
                  title={t(toggle.title)}
                  subtitle={t(toggle.subtitle)}
                  checked={Boolean(settings[toggle.key])}
                  onCheckedChange={(checked) => void saver.set(settings, toggle.key, checked)}
                />
              ))}
            </ListGroup>

            <ListGroup header={t("notifications.marketingNews")} footer={t("notifications.autoSaveHint")}>
              <SwitchRow
                leading={<IconTile icon={Megaphone} tone="amber" />}
                title={t("notifications.offers")}
                subtitle={t("notifications.offersDescription")}
                checked={Boolean(settings.notifyMarketing)}
                onCheckedChange={(checked) => void saver.set(settings, "notifyMarketing", checked)}
              />
            </ListGroup>
          </>
        )}
      </div>
    </Screen>
  );
}
