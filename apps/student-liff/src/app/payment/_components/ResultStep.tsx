"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, CreditCard, Home, RotateCw, ShieldCheck, XCircle } from "lucide-react";
import {
  AppBar,
  BottomActionBar,
  Chip,
  LoadingAnnouncement,
  Screen,
  Spinner,
  StatusScreen,
} from "@/components/mobile";
import { Confetti } from "@/components/celebrate/Confetti";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getChargeFailureKey, getPaymentMethodLabelKey, type PaymentMethod } from "@/lib/paymentFlow";
import { cn } from "@/lib/utils";

/* ─── Card result (3DS return: pending / failed) ─────────────────────────── */

export interface CardResultStepProps {
  status: "pending" | "failed";
  /** Omise failure message (English): only used to pick friendly copy. */
  failureMessage: string | null;
  loading: boolean;
  onCheckAgain: () => void;
  onRetryCard: () => void;
  onChangeMethod: () => void;
}

/** After the bank's 3DS page: still pending (check again) or failed (pay again). */
export function CardResultStep({
  status,
  failureMessage,
  loading,
  onCheckAgain,
  onRetryCard,
  onChangeMethod,
}: CardResultStepProps) {
  const failed = status === "failed";
  return (
    <Screen>
      <AppBar title={t("payment.result.title")} onBack={onChangeMethod} />
      <div role="status" aria-live="polite" className="flex flex-1 flex-col">
        <StatusScreen
          icon={failed ? XCircle : Clock}
          tone={failed ? "red" : "amber"}
          title={failed ? t("payment.result.failedTitle") : t("payment.result.pendingTitle")}
          description={
            failed ? t(getChargeFailureKey(failureMessage, "card")) : t("payment.result.pendingDescription")
          }
        />
      </div>
      <BottomActionBar>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {failed ? (
            <Button variant="brand" size="cta" className="w-full" onClick={onRetryCard}>
              <CreditCard aria-hidden="true" />
              {t("payment.result.tryAgain")}
            </Button>
          ) : (
            <Button variant="brand" size="cta" className="w-full" loading={loading} onClick={onCheckAgain}>
              {loading ? null : <RotateCw aria-hidden="true" />}
              {loading ? t("payment.result.checking") : t("payment.result.checkAgain")}
            </Button>
          )}
          <Button variant="brandSoft" size="touch" className="w-full" disabled={loading} onClick={onChangeMethod}>
            {t("payment.result.changeMethod")}
          </Button>
        </div>
      </BottomActionBar>
    </Screen>
  );
}

/* ─── Success ────────────────────────────────────────────────────────────── */

export interface SuccessStepProps {
  classTitle: string;
  tutor: string;
  amountSatang: number | null;
  method: PaymentMethod;
}

function ReceiptRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[15px] leading-[1.5]">
      <dt className="shrink-0 text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words text-fg">{children}</dd>
    </div>
  );
}

/** Receipt after a successful payment (or an already-active enrollment). */
export function SuccessStep({ classTitle, tutor, amountSatang, method }: SuccessStepProps) {
  return (
    <Screen>
      <Confetti intensity="big" origin={{ x: 0.5, y: 0.25 }} />
      <AppBar title={t("payment.select.title")} />
      <StatusScreen
        icon={CheckCircle2}
        mascot="cheer"
        tone="brand"
        title={t("payment.success.title")}
        description={t("payment.success.description")}
        className="justify-start pt-6 pb-6"
      >
        <dl className="divide-y divide-hairline rounded-[var(--radius-card)] border border-hairline bg-surface px-4 py-1.5 text-left shadow-[var(--shadow-card)]">
          <ReceiptRow label={t("payment.success.classLabel")}>{classTitle}</ReceiptRow>
          <ReceiptRow label={t("payment.success.tutorLabel")}>{tutor}</ReceiptRow>
          {amountSatang !== null ? (
            <ReceiptRow label={t("payment.success.amountLabel")}>
              <span className="tabular-nums">{formatSatang(amountSatang)}</span>
            </ReceiptRow>
          ) : null}
          <ReceiptRow label={t("payment.success.methodLabel")}>{t(getPaymentMethodLabelKey(method))}</ReceiptRow>
          <ReceiptRow label={t("payment.success.statusLabel")}>
            <Chip tone="success" icon={CheckCircle2}>
              {t("payment.success.confirmedStatus")}
            </Chip>
          </ReceiptRow>
        </dl>
        <p className="mt-4 text-[13px] leading-[1.6] text-fg-muted">{t("payment.success.lineNotice")}</p>
      </StatusScreen>
      <BottomActionBar>
        <Link
          href="/dashboard"
          id="btn-go-dashboard"
          className={cn(buttonVariants({ variant: "brand", size: "cta" }), "flex-1")}
        >
          <Home aria-hidden="true" />
          {t("payment.success.dashboardCta")}
        </Link>
      </BottomActionBar>
    </Screen>
  );
}

/* ─── Interim screens ────────────────────────────────────────────────────── */

/** Shown while the webview leaves for the bank's 3DS page (the pay button cannot be tapped again). */
export function RedirectingScreen({ authorizeUri }: { authorizeUri: string }) {
  return (
    <Screen>
      <StatusScreen
        icon={ShieldCheck}
        tone="brand"
        title={t("payment.redirect.title")}
        description={t("payment.redirect.description")}
        primaryAction={
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" className="text-icon-brand" label={t("payment.redirect.title")} />
            <a
              href={authorizeUri}
              className={cn(buttonVariants({ variant: "ghost", size: "touch" }), "text-brand-fg")}
            >
              {t("payment.redirect.fallback")}
            </a>
          </div>
        }
      />
    </Screen>
  );
}

/** Shown while a returned intent (3DS return) is checked, instead of flashing the method screen. */
export function ResumingScreen() {
  return (
    <Screen>
      <AppBar title={t("payment.select.title")} />
      <LoadingAnnouncement label={t("payment.resume.title")} />
      <StatusScreen
        icon={ShieldCheck}
        tone="brand"
        title={t("payment.resume.title")}
        description={t("payment.resume.description")}
      >
        <Spinner size="lg" className="mx-auto text-icon-brand" />
      </StatusScreen>
    </Screen>
  );
}
