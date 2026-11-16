"use client";

import { Bell, BellOff, Gavel, LifeBuoy, MessageSquare } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { IconTile } from "./Atoms";
import { Dropdown, type DropdownPlacement } from "./Dropdown";
import { useNotifications } from "./Notifications";
import { ListRow } from "./Surface";

/**
 * Alert count pill (components.md §4): 22px, --danger-solid / --on-danger,
 * 600 12 tabular. Renders nothing at 0.
 */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-danger-solid px-1.5 text-xs leading-none font-semibold text-on-danger tabular",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Bell (44 on touch) with an 8px --danger-solid dot when there is anything
 * unread; the count is in the accessible name and the panel. Opens a small
 * panel linking to chats, open class auctions and answered support tickets.
 * Reads the shared NotificationsProvider (no polling here).
 */
export function NotificationBell({
  placement = "bottom-end",
  className,
}: {
  placement?: DropdownPlacement;
  className?: string;
}) {
  const { unreadChat, availableAuctions, supportUpdates, total, muted, setMuted } = useNotifications();
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
            "relative inline-flex size-10 shrink-0 items-center justify-center rounded-(--radius-ctl) text-fg-muted transition-colors duration-(--duration-fast) hover:bg-press hover:text-fg pointer-coarse:size-11",
            open && "bg-press text-fg",
            className,
          )}
        >
          <Bell aria-hidden="true" className="size-5" />
          {total > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-2.5 right-2.5 size-2 rounded-full bg-danger-solid ring-2 ring-surface-nav"
            />
          ) : null}
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <p className="text-[0.9375rem] font-semibold text-fg">{t("shell.notifications")}</p>
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              aria-pressed={muted}
              title={muted ? t("shell.notificationsUnmute") : t("shell.notificationsMute")}
              aria-label={muted ? t("shell.notificationsUnmute") : t("shell.notificationsMute")}
              className="relative inline-flex size-8 items-center justify-center rounded-(--radius-ctl-sm) text-fg-muted hover:bg-press hover:text-fg pointer-coarse:after:absolute pointer-coarse:after:-inset-1.5"
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
                  trailing={<CountBadge count={availableAuctions} className="bg-neutral-bg text-neutral-fg" />}
                  chevron={false}
                />
              ) : null}
              {supportUpdates > 0 ? (
                <ListRow
                  href="/dashboard/support"
                  onClick={close}
                  leading={<IconTile icon={LifeBuoy} tone="teal" size="sm" />}
                  title={t("shell.notificationsSupport")}
                  trailing={<CountBadge count={supportUpdates} />}
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
