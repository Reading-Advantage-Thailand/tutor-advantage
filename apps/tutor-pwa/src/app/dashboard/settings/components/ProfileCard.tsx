import { ShieldCheck } from "lucide-react";
import { Chip, StatusChip, Surface, UserAvatar } from "@/components/app";
import { t } from "@/lib/i18n";
import type { SettingsUser } from "../lib/verification";

export function verificationLabel(status: string | undefined): string {
  if (status === "VERIFIED") return t("dashboardSettings.verified");
  if (status === "PENDING") return t("dashboardSettings.pending");
  if (status === "REJECTED") return t("dashboardSettings.rejected");
  return t("dashboardSettings.unverified");
}

/** Read-only profile summary. Server component. */
export function ProfileCard({ user }: { user: SettingsUser }) {
  const name = user.displayName || t("dashboardSettings.displayNameFallback");
  const role = user.role?.replace("ROLE_", "");
  return (
    <Surface padding="lg">
      <div className="flex items-center gap-4">
        <UserAvatar name={name} src={user.profilePictureUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-fg">{name}</p>
          {user.email ? <p className="truncate text-sm text-fg-muted">{user.email}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusChip
              status={user.verificationStatus || "UNVERIFIED"}
              label={verificationLabel(user.verificationStatus)}
              icon={ShieldCheck}
            />
            <Chip tone="neutral">{!role || role === "TUTOR" ? t("dashboardSettings.roleTutor") : role}</Chip>
          </div>
        </div>
      </div>
    </Surface>
  );
}
