import { CalendarClock } from "lucide-react";
import { Notice } from "@/components/app";
import { t } from "@/lib/i18n";
import { documentExpiryWarningTexts, payoutBlockText } from "../lib/documentExpiry";
import type { TutorIdentity } from "../lib/verification";

/**
 * Warning before a passport / work permit expires (payouts would pause).
 * Rendered on the dashboard home (links to Settings #verify, and with
 * showPayoutBlock also the danger notice once payouts are paused) and inside
 * the Settings verification section (no link; that section renders the
 * payout-block notice itself). No hooks: works in RSC and client.
 */
export function DocumentExpiryNotice({
  identity,
  href,
  showPayoutBlock = false,
}: {
  identity?: TutorIdentity | null;
  href?: string;
  showPayoutBlock?: boolean;
}) {
  const blockText = showPayoutBlock ? payoutBlockText(identity?.payoutBlock) : null;
  const lines = documentExpiryWarningTexts(identity);
  if (!blockText && lines.length === 0) return null;
  return (
    <>
      {blockText ? (
        // role="alert" would replace the link role when href is set.
        <Notice tone="danger" role={href ? undefined : "alert"} href={href}>
          {blockText}
        </Notice>
      ) : null}
      {lines.length > 0 ? (
        <Notice tone="warning" icon={CalendarClock} title={t("dashboardSettings.expiryWarningTitle")} href={href}>
          {lines.length === 1 ? (
            lines[0]
          ) : (
            <span className="flex flex-col gap-1">
              {lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          )}
        </Notice>
      ) : null}
    </>
  );
}
