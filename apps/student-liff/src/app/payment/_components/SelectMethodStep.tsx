"use client";

import { useRef, type KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Check, ChevronRight, CreditCard, Lock, MessageCircle, QrCode, ShieldCheck } from "lucide-react";
import { AppBar, BottomActionBar, Chip, IconTile, Screen, type IconTileTone } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { OrderDisplay, PaymentMethod } from "@/lib/paymentFlow";
import { cn } from "@/lib/utils";
import { businessContact } from "@/lib/businessContact";
import { PaymentPolicyNotice } from "@/components/legal/PaymentPolicyNotice";
import { DiscountCodeCard, type DiscountCodeCardProps } from "./DiscountCodeCard";
import { OrderSummaryCard } from "./OrderSummaryCard";
import { PaymentStepCaption } from "./PaymentStepCaption";
import { keepThaiWords } from "./ThaiText";
import type { LoadStatus } from "./usePaymentFlow";

const LINE_CONTACT_URL = businessContact.lineUrl;

type MethodOption = {
  /** Kept from the old page (QA/analytics may target them). */
  id: string;
  method: PaymentMethod;
  icon: LucideIcon;
  /** Same tones as the payment history rows (PromptPay teal, card amber). */
  tone: IconTileTone;
  label: string;
  sub: string;
  recommended: boolean;
};

function getMethodOptions(): MethodOption[] {
  return [
    {
      id: "pm-promptpay",
      method: "promptpay",
      icon: QrCode,
      tone: "teal",
      label: t("payment.methods.promptpay"),
      sub: t("payment.select.promptpaySub"),
      recommended: true,
    },
    {
      id: "pm-card",
      method: "card",
      icon: CreditCard,
      tone: "amber",
      label: t("payment.methods.card"),
      sub: t("payment.select.cardSub"),
      recommended: false,
    },
  ];
}

interface MethodRadioGroupProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  labelledBy: string;
}

/**
 * Selectable method cards (role=radiogroup, arrow keys move the choice).
 * Tappable, so they carry the clay ledge; selected = 2px brand-fg border,
 * soft jade tint and a check badge (never colour alone).
 */
function MethodRadioGroup({ value, onChange, labelledBy }: MethodRadioGroupProps) {
  const options = getMethodOptions();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const nextIndex = (index + delta + options.length) % options.length;
    onChange(options[nextIndex].method);
    refs.current[nextIndex]?.focus();
  };

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-3 sm:grid sm:grid-cols-2">
      {options.map((option, index) => {
        const selected = option.method === value;
        return (
          <button
            key={option.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            id={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.method)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "flex min-h-[84px] w-full items-center gap-3.5 rounded-[var(--radius-card)] border-2 p-4 text-left [-webkit-tap-highlight-color:transparent]",
              "transition-[translate,box-shadow,background-color,border-color] duration-[var(--duration-press)] ease-[var(--ease-out)]",
              selected
                ? "border-brand-fg bg-brand-soft shadow-[0_2px_0_var(--brand-soft-border)]"
                : "border-clay-rim bg-surface shadow-[var(--shadow-tap)] active:translate-y-[2px] active:shadow-[0_1px_0_var(--clay-ledge)]",
            )}
          >
            <IconTile icon={option.icon} tone={option.tone} size="lg" className={selected ? "bg-surface" : undefined} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-base leading-[1.5] font-semibold text-fg">{option.label}</span>
                {option.recommended ? (
                  <Chip tone="brand" icon={BadgeCheck} className={selected ? "bg-surface" : undefined}>
                    {t("payment.select.recommendedBadge")}
                  </Chip>
                ) : null}
              </span>
              {/* Spans only (no no-break space): the radio's name stays the same text. */}
              <span className="mt-0.5 block text-sm leading-[1.6] text-fg-muted">{keepThaiWords(option.sub)}</span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                selected ? "border-brand-solid bg-brand-solid text-on-brand" : "border-field-border bg-surface",
              )}
            >
              {selected ? <Check className="size-4" strokeWidth={3.2} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TrustBadges() {
  const badges: Array<{ icon: LucideIcon; label: string }> = [
    { icon: Lock, label: t("payment.select.secureSsl") },
    { icon: ShieldCheck, label: t("payment.select.secureOmise") },
    { icon: BadgeCheck, label: t("payment.select.securePci") },
  ];
  return (
    <ul className="flex flex-wrap items-center justify-center gap-2">
      {badges.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-muted px-2.5 text-xs leading-[1.5] font-semibold text-fg-muted"
        >
          <Icon aria-hidden="true" className="size-3.5 shrink-0 text-icon-brand" strokeWidth={2.4} />
          {label}
        </li>
      ))}
    </ul>
  );
}

export interface SelectMethodStepProps {
  policyAccepted: boolean;
  onPolicyAcceptedChange: (accepted: boolean) => void;
  /** Back target when there is no in-app history (deep link). */
  backHref: string;
  classStatus: LoadStatus;
  display: OrderDisplay;
  onRetryClass: () => void;
  method: PaymentMethod;
  onSelectMethod: (method: PaymentMethod) => void;
  /** The code card (null when this checkout cannot take a code). */
  discount: DiscountCodeCardProps | null;
  /** An applied code leaves ฿0: no payment method to choose. */
  free: boolean;
  canProceed: boolean;
  /** The saved birthday/consent is still loading (button shows a spinner). */
  proceedLoading: boolean;
  onProceed: () => void;
}

/**
 * Step 1 (patterns.md S12): the order first (+ discount code), then the
 * method, then the checkout terms to accept right before the primary.
 */
export function SelectMethodStep({
  policyAccepted,
  onPolicyAcceptedChange,
  backHref,
  classStatus,
  display,
  onRetryClass,
  method,
  onSelectMethod,
  discount,
  free,
  canProceed,
  proceedLoading,
  onProceed,
}: SelectMethodStepProps) {
  return (
    <Screen>
      <AppBar title={t("payment.select.title")} back fallbackHref={backHref} />
      <PaymentStepCaption step={1} />
      <div className="flex flex-col gap-5 px-4 pt-4 pb-6">
        <OrderSummaryCard
          status={classStatus}
          display={display}
          discount={discount?.quote ?? null}
          onRetry={onRetryClass}
        />
        {discount && classStatus === "ready" ? <DiscountCodeCard {...discount} /> : null}

        {free ? null : (
          <section className="flex flex-col gap-3 pt-1">
            <h2 id="payment-method-heading" className="t-section text-fg">
              {t("payment.select.selectMethod")}
            </h2>
            <MethodRadioGroup value={method} onChange={onSelectMethod} labelledBy="payment-method-heading" />
          </section>
        )}

        <PaymentPolicyNotice accepted={policyAccepted} onAcceptedChange={onPolicyAcceptedChange} />

        <div className="flex flex-col items-center gap-3 text-center">
          {free ? null : <TrustBadges />}
          <p className="text-sm leading-[1.6] text-fg-muted">{t("payment.select.noExtraFee")}</p>
          <p className="flex flex-wrap items-center justify-center gap-x-1 text-sm leading-[1.6] text-fg-muted">
            {t("payment.select.contactPrefix")}{" "}
            <a
              href={LINE_CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-ctl-sm)] px-1.5 font-heading text-[15px] leading-[1.3] font-semibold text-brand-fg underline-offset-2 active:bg-press"
            >
              <MessageCircle aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={2.2} />
              {t("payment.select.contactLine")}
            </a>
          </p>
        </div>
      </div>

      <BottomActionBar>
        <Button
          id="btn-proceed-payment"
          variant="brand"
          size="cta-lg"
          className="flex-1"
          disabled={!canProceed || !policyAccepted}
          loading={proceedLoading}
          onClick={onProceed}
        >
          {free ? `${t("payment.discount.confirmPay")} ${formatSatang(0)}` : t("payment.select.proceed")}
          {proceedLoading ? null : <ChevronRight aria-hidden="true" />}
        </Button>
      </BottomActionBar>
    </Screen>
  );
}
