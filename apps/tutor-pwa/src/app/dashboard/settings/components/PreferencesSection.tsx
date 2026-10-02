"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, MessageCircle, Palette, Volume2, VolumeX } from "lucide-react";
import {
  CardHeader,
  IconTile,
  ListGroup,
  ListRow,
  Section,
  Surface,
  ThemeSegmented,
  toast,
  useNotifications,
} from "@/components/app";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import { updateSettingsAction } from "../../actions";

/** Theme picker card (3 states: system / light / dark). */
export function AppearanceSection() {
  return (
    <Section title={t("dashboardSettings.appearanceSection")}>
      <Surface padding="md">
        <CardHeader
          className="mb-3"
          icon={<IconTile icon={Palette} tone="purple" size="sm" />}
          title={t("dashboardSettings.themeLabel")}
          description={t("dashboardSettings.themeHint")}
        />
        <ThemeSegmented fullWidth className="md:w-auto" />
      </Surface>
    </Section>
  );
}

/** App sound (local, shared with the notification bell) + LINE notifications (server setting). */
export function NotificationSection({ lineNotification }: { lineNotification?: boolean }) {
  const { muted, setMuted } = useNotifications();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isPending, startTransition] = useTransition();
  const [lineEnabled, setLineEnabled] = useState(lineNotification === true);
  useEffect(() => {
    setLineEnabled(lineNotification === true);
  }, [lineNotification]);

  const toggleLine = (next: boolean) => {
    setLineEnabled(next);
    startTransition(async () => {
      try {
        await updateSettingsAction({ lineNotification: next });
      } catch {
        setLineEnabled(!next); // revert
        toast.error(t("dashboardSettings.lineNotificationFailed"));
      }
    });
  };

  return (
    <Section title={t("dashboardSettings.notificationSection")}>
      <ListGroup>
        <ListRow
          leading={<IconTile icon={mounted && muted ? VolumeX : Volume2} tone="teal" size="sm" />}
          title={t("dashboardSettings.appSoundTitle")}
          subtitle={t("dashboardSettings.appSoundDescription")}
          trailing={
            <Switch
              checked={mounted ? !muted : true}
              disabled={!mounted}
              onCheckedChange={(checked: boolean) => setMuted(!checked)}
              aria-label={t("dashboardSettings.appSoundTitle")}
            />
          }
        />
        <ListRow
          leading={<IconTile icon={lineEnabled ? MessageCircle : Bell} tone="brand" size="sm" />}
          title={t("dashboardSettings.lineNotificationTitle")}
          subtitle={t("dashboardSettings.lineNotificationDescription")}
          trailing={
            <Switch
              checked={lineEnabled}
              disabled={isPending}
              onCheckedChange={(checked: boolean) => toggleLine(checked)}
              aria-label={t("dashboardSettings.lineNotificationTitle")}
            />
          }
        />
      </ListGroup>
    </Section>
  );
}
