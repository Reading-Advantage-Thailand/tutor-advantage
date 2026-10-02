import { StatusChip } from "@/components/app";
import { t } from "@/lib/i18n";
import { getFieldStatus, type SettingsUser, type VerificationField } from "../lib/verification";

/** Per-document review status; renders nothing until something was submitted. */
export function FieldStatusChip({ user, field }: { user: SettingsUser; field: VerificationField }) {
  const status = getFieldStatus(user, field);
  if (status === "UNVERIFIED") return null;
  const label =
    status === "VERIFIED"
      ? t("dashboardSettings.verifiedBadge")
      : status === "PENDING"
        ? t("dashboardSettings.pendingBadge")
        : t("dashboardSettings.rejectedBadge");
  return <StatusChip status={status} label={label} size="sm" />;
}
