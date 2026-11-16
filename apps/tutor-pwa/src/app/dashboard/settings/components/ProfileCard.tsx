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

/**
 * Read-only profile summary (patterns.md T8, the first settings group): the
 * avatar and name, the e-mail, then a well with the verification status chip
 * (icon + word) and the role. Server component.
 */
export function ProfileCard({ user }: { user: SettingsUser }) {
  const name = user.displayName || t("dashboardSettings.displayNameFallback");
  const role = user.role?.replace("ROLE_", "");
  return (
    <Surface padding="none" className="overflow-hidden">
      <div className="flex items-center gap-4 p-4 md:p-5">
        <UserAvatar name={name} src={user.profilePictureUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="type-section text-balance-th break-words text-fg">{name}</p>
          {user.email ? (
            <p className="type-body-s [overflow-wrap:anywhere] text-fg-muted">{user.email}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-hairline bg-surface-muted px-4 py-3 md:px-5">
        <StatusChip
          status={user.verificationStatus || "UNVERIFIED"}
          label={verificationLabel(user.verificationStatus)}
          icon={ShieldCheck}
        />
        <Chip tone="neutral">{!role || role === "TUTOR" ? t("dashboardSettings.roleTutor") : role}</Chip>
      </div>
    </Surface>
  );
}
