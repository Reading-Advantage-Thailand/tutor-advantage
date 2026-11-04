/**
 * Advance-warning copy for passports / work permits that expire soon
 * (identity /v1/users/me `identity.expiryWarnings`) and the payout-block
 * notice once one has lapsed. Tested in documentExpiry.test.ts.
 */
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { TutorIdentity } from "./verification";

type ExpiryWarning = NonNullable<TutorIdentity["expiryWarnings"]>[number];

/** Danger copy for an active payout block, or null when payouts are not blocked. */
export function payoutBlockText(block: TutorIdentity["payoutBlock"]): string | null {
  if (block === "PASSPORT_EXPIRED") return t("dashboardSettings.payoutBlockedPassportExpired");
  if (block === "WORK_PERMIT_EXPIRED") return t("dashboardSettings.payoutBlockedWorkPermitExpired");
  if (block === "WORK_PERMIT_MISSING") return t("dashboardSettings.payoutBlockedWorkPermitMissing");
  return null;
}

/**
 * True when the payout-block notice already covers this document. A missing or
 * expired passport blocks everything; a work-permit block says nothing about
 * the passport, so its advance warning still shows.
 */
function coveredByPayoutBlock(warning: ExpiryWarning, block: TutorIdentity["payoutBlock"]) {
  if (block === "PASSPORT_EXPIRED") return true;
  if (block === "WORK_PERMIT_EXPIRED" || block === "WORK_PERMIT_MISSING") return warning.document === "WORK_PERMIT";
  return false;
}

/** One line per expiring document not already covered by the payout-block notice. */
export function documentExpiryWarningTexts(identity: TutorIdentity | null | undefined): string[] {
  if (!identity) return [];
  return (identity.expiryWarnings ?? [])
    .filter((warning) => !coveredByPayoutBlock(warning, identity.payoutBlock))
    .map((warning) => {
      const isPassport = warning.document === "PASSPORT";
      const template =
        warning.daysLeft <= 0
          ? t(isPassport ? "dashboardSettings.expiryWarningPassportToday" : "dashboardSettings.expiryWarningWorkPermitToday")
          : t(isPassport ? "dashboardSettings.expiryWarningPassport" : "dashboardSettings.expiryWarningWorkPermit");
      return template
        .replaceAll("{days}", String(warning.daysLeft))
        .replaceAll("{dayUnit}", warning.daysLeft === 1 ? "day" : "days")
        .replaceAll("{date}", formatThaiDate(warning.expiresOn))
        .replaceAll("{isoDate}", warning.expiresOn);
    });
}
