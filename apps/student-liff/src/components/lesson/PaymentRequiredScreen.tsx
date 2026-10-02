"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { AppBar, Screen, StatusScreen } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import type { PaymentRequiredData } from "@/hooks/useLessonSocket";
import { formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { buildPaymentBackUrl, buildPaymentUrl, getPaymentBookLabel } from "./lessonPayment";

interface PaymentRequiredScreenProps {
  data: PaymentRequiredData;
  classId: string | null | undefined;
  /** App bar title of the screen this replaces (lobby / live lesson). */
  title: string;
}

/**
 * Full-page "pay for this book first" state, shared by the lobby and the live
 * lesson (socket `payment_required`). Same destinations as before:
 * buildPaymentUrl() for the CTA and the class page (or home) for "back".
 */
export function PaymentRequiredScreen({ data, classId, title }: PaymentRequiredScreenProps) {
  const bookLabel = getPaymentBookLabel(data) ?? t("lessonLobby.paymentBookFallback");
  const amount = data.packagePriceSatang != null ? formatSatang(data.packagePriceSatang, { fractionDigits: 0 }) : null;
  const backHref = buildPaymentBackUrl(classId);

  return (
    <Screen>
      <AppBar title={title} back fallbackHref={backHref} />
      <StatusScreen
        icon={Wallet}
        tone="amber"
        title={t("lessonLobby.paymentTitle")}
        description={`${t("lessonLobby.paymentDescriptionPrefix")} ${bookLabel} ${t("lessonLobby.paymentDescriptionSuffix")}`}
        primaryAction={
          <Link href={buildPaymentUrl(data, classId)} className={cn(buttonVariants({ variant: "brand", size: "cta" }), "w-full")}>
            {t("lessonLobby.paymentCta")}
          </Link>
        }
        secondaryAction={
          <Link href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "cta" }), "w-full text-fg-muted")}>
            {t("lessonLobby.paymentBack")}
          </Link>
        }
      >
        {amount ? (
          <div className="w-full rounded-2xl border border-hairline bg-surface px-4 py-3">
            <p className="text-[13px] leading-[1.5] font-semibold text-fg-muted">{t("lessonLobby.paymentAmountLabel")}</p>
            <p className="mt-0.5 text-[26px] leading-[1.3] font-extrabold text-fg tabular-nums">{amount}</p>
          </div>
        ) : null}
      </StatusScreen>
    </Screen>
  );
}
