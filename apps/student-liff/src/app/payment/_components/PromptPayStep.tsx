"use client";

import Image from "next/image";
import { Download, QrCode, RotateCw, Smartphone } from "lucide-react";
import { AppBar, BottomActionBar, Notice, Screen, Skeleton, Spinner } from "@/components/mobile";
import { Button, buttonVariants } from "@/components/ui/button";
import { t, type I18nKey } from "@/lib/i18n";
import type { QrCtaMode } from "@/lib/paymentFlow";
import { cn } from "@/lib/utils";
import { AmountCard } from "./AmountCard";
import { PaymentStepCaption } from "./PaymentStepCaption";
import { QrCountdown } from "./QrCountdown";
import { keepThaiWords } from "./ThaiText";

export interface PromptPayStepProps {
  amountSatang: number | null;
  hasIntent: boolean;
  /** data: URI of the PromptPay QR (null until loaded). */
  qrDataUri: string | null;
  qrLoading: boolean;
  expiresAt: number | null;
  expired: boolean;
  failed: boolean;
  polling: boolean;
  ctaMode: QrCtaMode;
  onPrimary: () => void;
  onRetryQrImage: () => void;
  onBack: () => void;
}

const CTA_LABEL: Record<QrCtaMode, I18nKey> = {
  create: "payment.promptpay.createQr",
  creating: "payment.promptpay.creating",
  regenerate: "payment.promptpay.regenerateQr",
  verify: "payment.promptpay.checkStatus",
  verifying: "payment.promptpay.checking",
};

/** File name for "บันทึกรูป QR" (same image the bank app scans). */
const QR_FILE_NAME = "promptpay-qr.png";

/** 232px code + the 16px quiet zone on each side. */
const QR_BOX = "size-[264px]";

function QrBox({
  dataUri,
  loading,
  dimmed,
  dimLabel,
  hasIntent,
  onRetry,
}: {
  dataUri: string | null;
  loading: boolean;
  dimmed: boolean;
  dimLabel: string | null;
  hasIntent: boolean;
  onRetry: () => void;
}) {
  // A code to scan sits on the always-white `.qr-container` with a 16px quiet
  // zone, also in dark mode, so banking apps can read it.
  if (dataUri && !loading) {
    return (
      <div className={cn("qr-container relative mx-auto p-4", QR_BOX)}>
        <Image
          src={dataUri}
          alt={t("payment.promptpay.qrAlt")}
          width={232}
          height={232}
          unoptimized
          className={cn("size-[232px] object-contain", dimmed && "opacity-25")}
        />
        {dimmed && dimLabel ? (
          // An opaque token pill: readable over the white box in both themes.
          <span className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-clay-rim bg-surface-elevated px-4 py-2 text-center text-[15px] leading-[1.5] font-semibold text-fg shadow-[var(--shadow-popover)]">
            {dimLabel}
          </span>
        ) : null}
      </div>
    );
  }

  // No code yet (loading) or none to show: a muted well in theme colours, same size.
  return (
    <div className={cn("well relative mx-auto flex items-center justify-center border-[1.5px] border-clay-rim", QR_BOX)}>
      {loading ? (
        <div className="flex size-[232px] flex-col items-center justify-center gap-3">
          <Skeleton className="size-[232px] rounded-xl" />
          <span className="sr-only">{t("payment.promptpay.qrCreating")}</span>
        </div>
      ) : !hasIntent ? (
        // Creating the QR failed (the notice below explains it): a still
        // placeholder, not a skeleton that would look like it is still loading.
        <QrCode aria-hidden="true" className="size-16 text-fg-subtle" strokeWidth={1.5} />
      ) : (
        <div className="flex flex-col items-center gap-3 px-4 text-center">
          <QrCode aria-hidden="true" className="size-10 text-fg-subtle" strokeWidth={1.6} />
          <p className="text-[15px] leading-[1.6] font-semibold text-fg">{t("payment.promptpay.qrLoadFailed")}</p>
          <Button variant="outline" size="touch" onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            {t("payment.promptpay.qrLoadRetry")}
          </Button>
        </div>
      )}
      {dimmed && dimLabel ? (
        <span className="absolute inset-x-6 bottom-5 rounded-full border-[1.5px] border-clay-rim bg-surface-elevated px-4 py-2 text-center text-[15px] leading-[1.5] font-semibold text-fg">
          {dimLabel}
        </span>
      ) : null}
    </div>
  );
}

/** PromptPay: amount, QR (save to gallery for same-phone payment), steps, status. */
export function PromptPayStep({
  amountSatang,
  hasIntent,
  qrDataUri,
  qrLoading,
  expiresAt,
  expired,
  failed,
  polling,
  ctaMode,
  onPrimary,
  onRetryQrImage,
  onBack,
}: PromptPayStepProps) {
  const qrReady = Boolean(qrDataUri) && !qrLoading;
  const live = qrReady && !expired && !failed;
  const busy = ctaMode === "creating" || ctaMode === "verifying";
  const dimLabel = failed ? t("payment.promptpay.qrFailed") : expired ? t("payment.promptpay.qrExpired") : null;
  const steps = [
    t("payment.promptpay.step1"),
    t("payment.promptpay.step2"),
    t("payment.promptpay.step3"),
    t("payment.promptpay.step4"),
  ];

  return (
    <Screen>
      <AppBar title={t("payment.promptpay.title")} onBack={onBack} />
      <PaymentStepCaption step={2} />
      {/* Phone: one column. ≥ 768 (the full app column): the QR card left, status and the how-to right. */}
      <div className="grid gap-5 px-4 pt-4 pb-6 md:grid-cols-2 md:items-start">
        {/* The QR card: amount, the white scan box, the countdown and the save action. */}
        <section
          className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface px-4 pt-5 pb-5 shadow-[var(--shadow-card)] max-[359px]:px-2.5"
          aria-label={t("payment.promptpay.qrAlt")}
        >
          <AmountCard label={t("payment.promptpay.amountDue")} amountSatang={amountSatang} />

          <QrBox
            dataUri={qrDataUri}
            loading={qrLoading || (!hasIntent && busy)}
            dimmed={expired || failed}
            dimLabel={dimLabel}
            hasIntent={hasIntent}
            onRetry={onRetryQrImage}
          />

          <div className="flex flex-col items-center gap-2 text-center empty:hidden">
            {/* role=timer, outside the live region: a screen reader must not read it every second. */}
            {live && expiresAt !== null ? <QrCountdown expiresAt={expiresAt} /> : null}
            <div aria-live="polite" className="flex justify-center empty:hidden">
              {live && polling ? (
                <p className="inline-flex items-center gap-2 text-sm leading-[1.6] text-fg-muted">
                  <Spinner size="sm" className="text-icon-brand" />
                  {t("payment.promptpay.waiting")}
                </p>
              ) : null}
            </div>
          </div>

          {live && qrDataUri ? (
            <div className="flex w-full flex-col items-center gap-2">
              <a
                href={qrDataUri}
                download={QR_FILE_NAME}
                className={cn(buttonVariants({ variant: "outline", size: "touch" }), "w-full max-w-[264px]")}
              >
                <Download aria-hidden="true" />
                {t("payment.promptpay.saveQr")}
              </a>
              <p className="max-w-[300px] text-center text-[13px] leading-[1.6] text-balance text-fg-muted">
                {keepThaiWords(t("payment.promptpay.saveQrHint"))}
              </p>
            </div>
          ) : null}
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          {!hasIntent && ctaMode === "create" ? (
            <Notice
              tone="danger"
              role="alert"
              title={t("payment.promptpay.createFailedTitle")}
              description={t("payment.promptpay.createFailedDescription")}
            />
          ) : failed ? (
            <Notice
              tone="danger"
              role="alert"
              title={t("payment.promptpay.failedTitle")}
              description={t("payment.promptpay.failedDescription")}
            />
          ) : expired ? (
            <Notice
              tone="warning"
              role="alert"
              title={t("payment.promptpay.expiredTitle")}
              description={t("payment.promptpay.expiredDescription")}
            />
          ) : null}

          <section
            aria-labelledby="promptpay-steps-title"
            className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-5 shadow-[var(--shadow-card)]"
          >
            <h2 id="promptpay-steps-title" className="t-title-s flex items-center gap-2.5 text-fg">
              <Smartphone aria-hidden="true" className="size-5 shrink-0 text-icon-brand" strokeWidth={2.2} />
              {t("payment.promptpay.stepsTitle")}
            </h2>
            <ol className="mt-3.5 flex flex-col gap-3">
              {steps.map((text, index) => (
                <li key={text} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm leading-none font-semibold text-brand-soft-fg tabular-nums shadow-[inset_0_0_0_1.5px_var(--brand-soft-border)]"
                  >
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-[15px] leading-[1.6] text-fg">{keepThaiWords(text)}</span>
                </li>
              ))}
            </ol>
            <p className="well mt-4 px-4 py-3 text-sm leading-[1.6] text-balance text-fg-muted">
              {keepThaiWords(t("payment.promptpay.otherDeviceHint"))}
            </p>
          </section>
        </div>
      </div>

      <BottomActionBar>
        <Button
          id="btn-confirm-promptpay"
          variant="brand"
          size="cta-lg"
          className="flex-1"
          loading={busy}
          onClick={onPrimary}
        >
          {ctaMode === "regenerate" ? <RotateCw aria-hidden="true" /> : null}
          {t(CTA_LABEL[ctaMode])}
        </Button>
      </BottomActionBar>
    </Screen>
  );
}
