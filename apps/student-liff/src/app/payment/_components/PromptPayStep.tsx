"use client";

import Image from "next/image";
import { Download, QrCode, RotateCw, Smartphone } from "lucide-react";
import { AppBar, BottomActionBar, Notice, Screen, Skeleton, Spinner } from "@/components/mobile";
import { Button, buttonVariants } from "@/components/ui/button";
import { t, type I18nKey } from "@/lib/i18n";
import type { QrCtaMode } from "@/lib/paymentFlow";
import { cn } from "@/lib/utils";
import { AmountCard } from "./AmountCard";
import { QrCountdown } from "./QrCountdown";

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
  // Always white (also in dark mode) so banking apps can read the code.
  return (
    <div className="relative mx-auto flex size-[260px] items-center justify-center rounded-3xl border border-hairline bg-white p-3.5 shadow-[var(--shadow-card)]">
      {dataUri && !loading ? (
        <Image
          src={dataUri}
          alt={t("payment.promptpay.qrAlt")}
          width={232}
          height={232}
          unoptimized
          className={cn("size-[232px] rounded-lg object-contain", dimmed && "opacity-25")}
        />
      ) : loading ? (
        <div className="flex size-[232px] flex-col items-center justify-center gap-3">
          <Skeleton className="size-[232px] rounded-lg" />
          <span className="sr-only">{t("payment.promptpay.qrCreating")}</span>
        </div>
      ) : !hasIntent ? (
        // Creating the QR failed (the notice below explains it): a still
        // placeholder, not a skeleton that would look like it is still loading.
        <div
          aria-hidden="true"
          className="flex size-[232px] items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50"
        >
          <QrCode className="size-16 text-slate-300" strokeWidth={1.5} />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 px-4 text-center">
          <p className="text-sm leading-[1.5] font-semibold text-slate-700">{t("payment.promptpay.qrLoadFailed")}</p>
          <button
            type="button"
            onClick={onRetry}
            className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800 active:bg-slate-200"
          >
            <RotateCw aria-hidden="true" className="size-4" />
            {t("payment.promptpay.qrLoadRetry")}
          </button>
        </div>
      )}
      {dimmed && dimLabel ? (
        <span className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-full bg-slate-900/85 px-4 py-2 text-center text-sm leading-[1.5] font-bold text-white">
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
      <div className="flex flex-col gap-5 px-4 pt-3 pb-6">
        <AmountCard label={t("payment.promptpay.amountDue")} amountSatang={amountSatang} />

        <section className="flex flex-col items-center gap-3" aria-label={t("payment.promptpay.qrAlt")}>
          <QrBox
            dataUri={qrDataUri}
            loading={qrLoading || (!hasIntent && busy)}
            dimmed={expired || failed}
            dimLabel={dimLabel}
            hasIntent={hasIntent}
            onRetry={onRetryQrImage}
          />

          <div className="flex flex-col items-center gap-1 text-center empty:hidden">
            {/* role=timer, outside the live region: a screen reader must not read it every second. */}
            {live && expiresAt !== null ? <QrCountdown expiresAt={expiresAt} /> : null}
            <div aria-live="polite" className="flex justify-center empty:hidden">
              {live && polling ? (
                <p className="inline-flex items-center gap-1.5 text-[13px] leading-[1.5] text-fg-muted">
                  <Spinner size="sm" />
                  {t("payment.promptpay.waiting")}
                </p>
              ) : null}
            </div>
          </div>

          {live && qrDataUri ? (
            <div className="flex w-full flex-col items-center gap-1.5">
              <a
                href={qrDataUri}
                download={QR_FILE_NAME}
                className={cn(buttonVariants({ variant: "brandSoft", size: "touch" }), "w-full max-w-[260px]")}
              >
                <Download aria-hidden="true" />
                {t("payment.promptpay.saveQr")}
              </a>
              <p className="max-w-[300px] text-center text-xs leading-[1.5] text-fg-muted">
                {t("payment.promptpay.saveQrHint")}
              </p>
            </div>
          ) : null}
        </section>

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

        <section className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
          <h2 className="flex items-center gap-2 text-[15px] leading-[1.5] font-bold text-fg">
            <Smartphone aria-hidden="true" className="size-[18px] text-icon-brand" />
            {t("payment.promptpay.stepsTitle")}
          </h2>
          <ol className="mt-3 flex flex-col gap-3">
            {steps.map((text, index) => (
              <li key={text} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-solid text-xs font-bold text-white"
                >
                  {index + 1}
                </span>
                <span className="text-sm leading-[1.6] text-fg">{text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-hairline pt-3 text-[13px] leading-[1.6] text-fg-muted">
            {t("payment.promptpay.otherDeviceHint")}
          </p>
        </section>
      </div>

      <BottomActionBar>
        <Button
          id="btn-confirm-promptpay"
          variant="brand"
          size="cta"
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
