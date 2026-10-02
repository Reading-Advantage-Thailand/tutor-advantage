"use client";

import { Dialog } from "@base-ui/react/dialog";
import { LogOut, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";
import { UserAvatar } from "./Atoms";
import { EnvBadge } from "./EnvBadge";
import { logout } from "./session";
import { useShell } from "./ShellContext";
import { BrandMark, NavList } from "./SideNav";
import { ThemeSegmented } from "./ThemeSegmented";

export interface NavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
}

/**
 * Left navigation drawer for phones and tablets (<1024px): every section
 * the role can open (grouped, with work-queue badges), theme, account and
 * logout. Loaded lazily (Base UI Dialog).
 */
export function NavDrawerImpl({ open, onOpenChange, pathname }: NavDrawerProps) {
  const { user, environment } = useShell();
  const name = user?.name || user?.email || t("shell.account");
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="nav-drawer-backdrop" />
        <Dialog.Popup className="nav-drawer" aria-label={t("shell.mainNavigation")}>
          <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
            <BrandMark />
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-sm leading-tight font-semibold text-fg">{t("shell.brandName")}</Dialog.Title>
              <p className="truncate text-xs leading-tight text-fg-muted">{t("shell.brandRole")}</p>
            </div>
            <Dialog.Close
              aria-label={t("shell.close")}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-press hover:text-fg"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            <NavList pathname={pathname} variant="drawer" onNavigate={() => onOpenChange(false)} />
          </nav>
          <div className="flex flex-col gap-3 border-t border-hairline px-4 py-3">
            <div className="flex items-center gap-3">
              <UserAvatar name={name} src={user?.picture || undefined} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{name}</p>
                <p className="truncate text-xs text-fg-muted">{user ? statusLabel("userRole", user.role) : ""}</p>
              </div>
              <EnvBadge environment={environment} />
            </div>
            <ThemeSegmented fullWidth />
            <button
              type="button"
              onClick={() => void logout()}
              className="flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-danger-fg hover:bg-danger-bg"
            >
              <LogOut aria-hidden="true" className="size-4" />
              {t("shell.logout")}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
