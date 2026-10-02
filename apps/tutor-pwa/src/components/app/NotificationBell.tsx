"use client";

import { Bell, BellOff, Gavel, MessageSquare } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { IconTile } from "./Atoms";
import { Dropdown, type DropdownPlacement } from "./Dropdown";
import { useNotifications } from "./Notifications";
import { ListRow } from "./Surface";

export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger-solid px-1 text-[0.6875rem] leading-none font-semibold text-white tabular",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Bell with total unread count; opens a small panel linking to chats and
 * open class auctions. Reads the shared NotificationsProvider (no polling here).
 */
export function NotificationBell({
  placement = "bottom-end",
  className,
}: {
  placement?: DropdownPlacement;
  className?: string;
}) {
  const { unreadChat, availableAuctions, total, muted, setMuted } = useNotifications();
  const label = total > 0 ? `${t("shell.notifications")} (${total})` : t("shell.notifications");
  return (
    <Dropdown
      label={t("shell.notifications")}
      placement={placement}
      trigger={({ open, triggerProps }) => (
        <button
          type="button"
          aria-label={label}
          {...triggerProps}
          className={cn(
            "relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-press hover:text-fg",
            open && "bg-press text-fg",
            className,
          )}
        >
          <Bell aria-hidden="true" className="size-5" />
          <CountBadge count={total} className="absolute -top-0.5 -right-0.5 ring-2 ring-surface" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <p className="text-sm font-semibold text-fg">{t("shell.notifications")}</p>
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              aria-pressed={muted}
              title={muted ? t("shell.notificationsUnmute") : t("shell.notificationsMute")}
              aria-label={muted ? t("shell.notificationsUnmute") : t("shell.notificationsMute")}
              className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-press hover:text-fg"
            >
              {muted ? <BellOff aria-hidden="true" className="size-4" /> : <Bell aria-hidden="true" className="size-4" />}
            </button>
          </div>
          {total === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-fg-muted">{t("shell.notificationsEmpty")}</p>
          ) : (
            <div className="py-1">
              {unreadChat > 0 ? (
                <ListRow
                  href="/dashboard/chat"
                  onClick={close}
                  leading={<IconTile icon={MessageSquare} tone="blue" size="sm" />}
                  title={t("shell.notificationsUnreadChat")}
                  trailing={<CountBadge count={unreadChat} />}
                  chevron={false}
                />
              ) : null}
              {availableAuctions > 0 ? (
                <ListRow
                  href="/dashboard/classes/auction"
                  onClick={close}
                  leading={<IconTile icon={Gavel} tone="amber" size="sm" />}
                  title={t("shell.notificationsAuctions")}
                  trailing={<CountBadge count={availableAuctions} className="bg-warning-solid text-on-warning" />}
                  chevron={false}
                />
              ) : null}
            </div>
          )}
        </>
      )}
    </Dropdown>
  );
}
