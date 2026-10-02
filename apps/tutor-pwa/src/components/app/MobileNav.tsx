"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, HelpCircle, LogOut, MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { IconTile, UserAvatar } from "./Atoms";
import {
  MORE_ITEMS,
  TAB_ITEMS,
  getBackHref,
  getDefaultTitle,
  isMoreActive,
  isNavItemActive,
} from "./navigation";
import { CountBadge, NotificationBell } from "./NotificationBell";
import { useNotifications } from "./Notifications";
import { HELP_URL } from "./constants";
import { logout } from "./session";
import { useShell } from "./ShellContext";
import { Sheet } from "./Sheet";
import { BrandMark } from "./SideNav";
import { ListGroup, ListRow } from "./Surface";
import { ThemeSegmented } from "./ThemeSegmented";

/**
 * Phone top bar (<768px): back button on nested pages (or the brand mark on
 * section roots), the page title (registered by <PageHeader>, else the
 * section name) and the notification bell. Sticky, opaque.
 */
export function AppBar() {
  const pathname = usePathname() ?? "";
  const { title, backHref: registeredBack } = useShell();
  const backHref = registeredBack ?? getBackHref(pathname);
  const barTitle = title ?? getDefaultTitle(pathname);
  return (
    <header className="app-appbar">
      <div className="flex h-(--appbar-h) items-center gap-1 pr-2 pl-2">
        {backHref ? (
          <Link
            href={backHref}
            aria-label={t("shell.back")}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-fg hover:bg-press"
          >
            <ChevronLeft aria-hidden="true" className="size-6" />
          </Link>
        ) : (
          <Link href="/dashboard" aria-label={t("shell.brandName")} className="inline-flex size-10 shrink-0 items-center justify-center">
            <BrandMark className="size-7 text-xs" />
          </Link>
        )}
        <p className="min-w-0 flex-1 truncate pl-1 text-[1.0625rem] font-semibold text-fg">{barTitle}</p>
        <NotificationBell className="size-10" />
      </div>
    </header>
  );
}

/**
 * Phone bottom tab bar: Home · Classes · Schedule · Chat · More, labels always
 * visible, badges from the shared notifications poller. Renders an in-flow
 * spacer so page content never hides behind it.
 */
export function TabBar() {
  const pathname = usePathname() ?? "";
  const counts = useNotifications();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = isMoreActive(pathname);

  // Close the sheet after navigating from it.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const tabClass = (active: boolean) =>
    cn(
      "flex min-w-0 flex-col items-center justify-center gap-1 pt-1.5 pb-1 text-[0.6875rem] leading-none font-medium transition-colors",
      active ? "text-brand-fg" : "text-fg-muted",
    );
  const pillClass = (active: boolean) =>
    cn(
      "relative flex h-7 w-14 items-center justify-center rounded-full transition-colors",
      active && "bg-brand-soft",
    );

  return (
    <>
      <div className="app-tabbar-spacer" aria-hidden="true" />
      <nav className="app-tabbar" aria-label={t("shell.mainNavigation")}>
        {TAB_ITEMS.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          const count = item.badge ? counts[item.badge] : 0;
          return (
            <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
              <span className={pillClass(active)}>
                <Icon aria-hidden="true" className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                {count > 0 ? <CountBadge count={count} className="absolute -top-1 right-1.5 h-4 min-w-4 text-[0.625rem] ring-2 ring-surface" /> : null}
              </span>
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={tabClass(moreActive)}
        >
          <span className={pillClass(moreActive)}>
            <MoreHorizontal aria-hidden="true" className="size-[22px]" strokeWidth={moreActive ? 2.2 : 1.8} />
          </span>
          <span>{t("shell.navMore")}</span>
        </button>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} pathname={pathname} />
    </>
  );
}

function MoreSheet({ open, onOpenChange, pathname }: { open: boolean; onOpenChange: (open: boolean) => void; pathname: string }) {
  const { user } = useShell();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("shell.moreTitle")}>
      <div className="flex flex-col gap-4">
        {user ? (
          <div className="flex items-center gap-3 rounded-xl bg-surface-muted px-3 py-3">
            <UserAvatar name={user.displayName} src={user.avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">{user.displayName || t("shell.account")}</p>
              <p className="truncate text-xs text-fg-muted">{user.email || t("shell.brandRole")}</p>
            </div>
          </div>
        ) : null}
        <ListGroup>
          {MORE_ITEMS.map((item) => {
            const active = isNavItemActive(item, pathname);
            return (
              <ListRow
                key={item.id}
                href={item.href}
                onClick={() => onOpenChange(false)}
                leading={<IconTile icon={item.icon} tone={active ? "brand" : "neutral"} size="sm" />}
                title={<span className={cn(active && "text-brand-fg")}>{item.label}</span>}
                lines={1}
              />
            );
          })}
        </ListGroup>
        <div>
          <p className="mb-2 px-1 text-sm font-semibold text-fg-muted">{t("shell.theme")}</p>
          <ThemeSegmented fullWidth />
        </div>
        <ListGroup>
          <a
            href={HELP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="list-row flex min-h-14 items-center gap-3 px-4 py-3 text-sm font-medium text-fg active:bg-press"
            data-leading=""
          >
            <IconTile icon={HelpCircle} tone="teal" size="sm" />
            {t("shell.help")}
          </a>
          <ListRow
            onClick={() => void logout()}
            leading={<IconTile icon={LogOut} tone="red" size="sm" />}
            title={t("shell.logout")}
            destructive
            lines={1}
          />
        </ListGroup>
      </div>
    </Sheet>
  );
}
