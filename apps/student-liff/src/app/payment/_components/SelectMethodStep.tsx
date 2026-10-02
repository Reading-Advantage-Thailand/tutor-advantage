"use client";

import { useRef, type KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, Check, ChevronRight, CreditCard, Lock, QrCode, ShieldCheck } from "lucide-react";
import { AppBar, BottomActionBar, Chip, IconTile, Screen } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import type { OrderDisplay, PaymentMethod } from "@/lib/paymentFlow";
import { cn } from "@/lib/utils";
import { OrderSummaryCard } from "./OrderSummaryCard";
import type { LoadStatus } from "./usePaymentFlow";

const LINE_CONTACT_URL = "https://lin.ee/R7Dccj9";

type MethodOption = {
  /** Kept from the old page (QA/analytics may target them). */
  id: string;
  method: PaymentMethod;
  icon: LucideIcon;
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
      label: t("payment.methods.promptpay"),
      sub: t("payment.select.promptpaySub"),
      recommended: true,
    },
    {
      id: "pm-card",
      method: "card",
      icon: CreditCard,
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

/** Native-feeling radio cards (role=radiogroup, arrow keys move the choice). */
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
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-3">
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
              "pressable flex min-h-[76px] w-full items-center gap-3.5 rounded-[var(--radius-card)] border p-4 text-left transition-colors duration-150 [-webkit-tap-highlight-color:transparent]",
              selected
                ? "border-brand-vivid bg-brand-soft ring-2 ring-brand-vivid/25"
                : "border-hairline bg-surface shadow-[var(--shadow-card)] active:bg-press",
            )}
          >
            <IconTile
              icon={option.icon}
              tone={selected ? "brand" : "neutral"}
              size="lg"
              className={selected ? "bg-surface" : undefined}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-base leading-[1.45] font-bold text-fg">{option.label}</span>
                {option.recommended ? (
                  <Chip tone="brand" icon={BadgeCheck}>
                    {t("payment.select.recommendedBadge")}
                  </Chip>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[13px] leading-[1.5] text-fg-muted">{option.sub}</span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                selected ? "border-brand-solid bg-brand-solid text-white" : "border-field-border",
              )}
            >
              {selected ? <Check className="size-3.5" strokeWidth={3.5} /> : null}
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
    <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      {badges.map(({ icon: Icon, label }) => (
        <li key={label} className="inline-flex items-center gap-1 text-xs leading-[1.5] font-medium text-fg-muted">
          <Icon aria-hidden="true" className="size-3.5 shrink-0 text-icon-brand" strokeWidth={2.4} />
          {label}
        </li>
      ))}
    </ul>
  );
}

export interface SelectMethodStepProps {
  /** Back target when there is no in-app history (deep link). */
  backHref: string;
  classStatus: LoadStatus;
  display: OrderDisplay;
  onRetryClass: () => void;
  method: PaymentMethod;
  onSelectMethod: (method: PaymentMethod) => void;
  canProceed: boolean;
  /** The saved birthday/consent is still loading (button shows a spinner). */
  proceedLoading: boolean;
  onProceed: () => void;
}

/** Step 1: order summary + choose PromptPay or card. */
export function SelectMethodStep({
  backHref,
  classStatus,
  display,
  onRetryClass,
  method,
  onSelectMethod,
  canProceed,
  proceedLoading,
  onProceed,
}: SelectMethodStepProps) {
  return (
    <Screen>
      <AppBar title={t("payment.select.title")} back fallbackHref={backHref} />
      <div className="flex flex-col gap-6 px-4 pt-3 pb-6">
        <OrderSummaryCard status={classStatus} display={display} onRetry={onRetryClass} />

        <section className="flex flex-col gap-3">
          <h2 id="payment-method-heading" className="text-[17px] leading-[1.5] font-bold text-fg">
            {t("payment.select.selectMethod")}
          </h2>
          <MethodRadioGroup value={method} onChange={onSelectMethod} labelledBy="payment-method-heading" />
        </section>

        <div className="flex flex-col items-center gap-2 text-center">
          <TrustBadges />
          <p className="text-[13px] leading-[1.6] text-fg-muted">
            {t("payment.select.noExtraFee")}
            <br />
            {t("payment.select.contactPrefix")}{" "}
            <a
              href={LINE_CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-semibold text-brand-fg underline-offset-2 active:underline"
            >
              {t("payment.select.contactLine")}
            </a>
          </p>
        </div>
      </div>

      <BottomActionBar>
        <Button
          id="btn-proceed-payment"
          variant="brand"
          size="cta"
          className="flex-1"
          disabled={!canProceed && !proceedLoading}
          loading={proceedLoading}
          onClick={onProceed}
        >
          {t("payment.select.proceed")}
          {proceedLoading ? null : <ChevronRight aria-hidden="true" />}
        </Button>
      </BottomActionBar>
    </Screen>
  );
}
