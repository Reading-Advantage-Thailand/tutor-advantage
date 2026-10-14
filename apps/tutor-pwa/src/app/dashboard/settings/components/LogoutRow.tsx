"use client";

import { LogOut } from "lucide-react";
import { IconTile, ListRow, logout } from "@/components/app";
import { t } from "@/lib/i18n";

/** Sign-out row: clears the client cache + SW page caches, POSTs /api/auth/logout, then goes to "/". */
export function LogoutRow() {
  return (
    <ListRow
      leading={<IconTile icon={LogOut} tone="red" size="sm" />}
      title={t("dashboardSettings.logout")}
      destructive
      onClick={() => void logout()}
    />
  );
}
