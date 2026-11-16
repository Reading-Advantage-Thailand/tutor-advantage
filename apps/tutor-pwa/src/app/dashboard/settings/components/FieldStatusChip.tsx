import { StatusChip } from "@/components/app";
import { t } from "@/lib/i18n";
import { getFieldStatus, type SettingsUser, type VerificationField } from "../lib/verification";

/**
 * Per-document review status (dot + word). Renders nothing until something
 * was submitted, unless `showUnsubmitted` (the KYC upload rows, patterns.md
 * T8) asks for the neutral "ยังไม่ได้ส่ง" chip.
 */
export function FieldStatusChip({
  user,
  field,
  showUnsubmitted = false,
}: {
  user: SettingsUser;
  field: VerificationField;
  showUnsubmitted?: boolean;
}) {
  const status = getFieldStatus(user, field);
  if (status === "UNVERIFIED") {
    return showUnsubmitted ? <StatusChip status={status} label={t("dashboardSettings.stepNotStarted")} tone="neutral" size="sm" /> : null;
  }
  const label =
    status === "VERIFIED"
      ? t("dashboardSettings.verifiedBadge")
      : status === "PENDING"
        ? t("dashboardSettings.pendingBadge")
        : t("dashboardSettings.rejectedBadge");
  return <StatusChip status={status} label={label} size="sm" />;
}
