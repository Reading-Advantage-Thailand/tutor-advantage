"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, CreditCard, DoorOpen, Home, RotateCw, ShieldCheck, XCircle } from "lucide-react";
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
import { lessonLobbyHref } from "@/lib/classAccess";
import { formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getChargeFailureKey, getPaymentMethodLabelKey } from "@/lib/paymentFlow";
import { cn } from "@/lib/utils";
import { PaymentStepCaption } from "./PaymentStepCaption";
import { ThaiText } from "./ThaiText";

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

/**
 * After the bank's 3DS page: still pending (check again) or failed (pay
 * again). Reedy calm while waiting, oops on a failure: the cause, then the recovery.
 */
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
      <PaymentStepCaption step={3} />
      <div role="status" aria-live="polite" className="flex flex-1 flex-col">
        <StatusScreen
          icon={failed ? XCircle : Clock}
          tone={failed ? "red" : "amber"}
          mascot={failed ? "oops" : "calm"}
          title={failed ? t("payment.result.failedTitle") : t("payment.result.pendingTitle")}
          description={
            <ThaiText
              text={failed ? t(getChargeFailureKey(failureMessage, "card")) : t("payment.result.pendingDescription")}
            />
          }
        />
      </div>
      <BottomActionBar>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {failed ? (
            <Button variant="brand" size="cta-lg" className="w-full" onClick={onRetryCard}>
              <CreditCard aria-hidden="true" />
              {t("payment.result.tryAgain")}
            </Button>
          ) : (
            <Button variant="brand" size="cta-lg" className="w-full" loading={loading} onClick={onCheckAgain}>
              {loading ? null : <RotateCw aria-hidden="true" />}
              {loading ? t("payment.result.checking") : t("payment.result.checkAgain")}
            </Button>
          )}
          <Button variant="outline" size="touch" className="w-full" disabled={loading} onClick={onChangeMethod}>
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
  /** The intent's method ("promptpay", "card", "DISCOUNT_CODE"). */
  method: string;
  /** The class the enrollment is in (null = unknown: home only). */
  classId: string | null;
}

function ReceiptRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2.5 text-[15px] leading-[1.6]">
      <dt className="shrink-0 text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words text-fg">{children}</dd>
    </div>
  );
}

/** Receipt after a successful payment (or an already-active enrollment): the class is open now. */
export function SuccessStep({ classTitle, tutor, amountSatang, method, classId }: SuccessStepProps) {
  return (
    <Screen>
      <Confetti intensity="big" origin={{ x: 0.5, y: 0.25 }} />
      <AppBar title={t("payment.select.title")} />
      <PaymentStepCaption step={3} />
      <StatusScreen
        icon={CheckCircle2}
        mascot="cheer"
        tone="brand"
        title={t("payment.success.title")}
        description={t("payment.success.description")}
        className="justify-start pt-6 pb-6"
      >
        <div className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface text-left shadow-[var(--shadow-card)]">
          {amountSatang !== null ? (
            <div className="flex flex-col items-center gap-0.5 border-b-[1.5px] border-hairline px-5 pt-4 pb-3.5 text-center">
              <span className="text-sm leading-[1.6] text-fg-muted">{t("payment.success.amountLabel")}</span>
              <span className="text-[28px] leading-[1.25] font-semibold text-fg tabular-nums">{formatSatang(amountSatang)}</span>
            </div>
          ) : null}
          <dl className="divide-y-[1.5px] divide-hairline px-5 py-1">
            <ReceiptRow label={t("payment.success.classLabel")}>{classTitle}</ReceiptRow>
            <ReceiptRow label={t("payment.success.tutorLabel")}>{tutor}</ReceiptRow>
            <ReceiptRow label={t("payment.success.methodLabel")}>{t(getPaymentMethodLabelKey(method))}</ReceiptRow>
            <ReceiptRow label={t("payment.success.statusLabel")}>
              <Chip tone="success" icon={CheckCircle2}>
                {t("payment.success.confirmedStatus")}
              </Chip>
            </ReceiptRow>
          </dl>
        </div>
        <p className="mt-4 text-sm leading-[1.6] text-fg-muted">{t("payment.success.lineNotice")}</p>
      </StatusScreen>
      <BottomActionBar>
        {classId ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <Link
              href={lessonLobbyHref(classId)}
              id="btn-enter-lesson"
              className={cn(buttonVariants({ variant: "brand", size: "cta-lg" }), "w-full")}
            >
              <DoorOpen aria-hidden="true" />
              {t("payment.success.lessonCta")}
            </Link>
            <Link
              href="/dashboard"
              id="btn-go-dashboard"
              className={cn(buttonVariants({ variant: "outline", size: "touch" }), "w-full")}
            >
              <Home aria-hidden="true" />
              {t("payment.success.dashboardCta")}
            </Link>
          </div>
        ) : (
          <Link
            href="/dashboard"
            id="btn-go-dashboard"
            className={cn(buttonVariants({ variant: "brand", size: "cta-lg" }), "flex-1")}
          >
            <Home aria-hidden="true" />
            {t("payment.success.dashboardCta")}
          </Link>
        )}
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
        mascot="calm"
        // No app bar on this screen: the title is its h1.
        as="h1"
        title={t("payment.redirect.title")}
        description={t("payment.redirect.description")}
        primaryAction={
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" className="text-icon-brand" label={t("payment.redirect.title")} />
            <a href={authorizeUri} className={buttonVariants({ variant: "ghost", size: "touch" })}>
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
        mascot="calm"
        title={t("payment.resume.title")}
        description={t("payment.resume.description")}
      >
        <Spinner size="lg" className="mx-auto text-icon-brand" />
      </StatusScreen>
    </Screen>
  );
}
