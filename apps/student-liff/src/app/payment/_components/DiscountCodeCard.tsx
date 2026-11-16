"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, TicketPercent, X } from "lucide-react";
import { IconButton, TextField } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { DiscountQuote } from "@/lib/paymentFlow";
import { ThaiText } from "./ThaiText";

const INPUT_ID = "input-discount-code";
const ERROR_ID = `${INPUT_ID}-error`;

// Container card: rim + soft shadow, no ledge.
const cardClass = "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-5 shadow-[var(--shadow-card)]";

export interface DiscountCodeCardProps {
  code: string;
  onCodeChange: (value: string) => void;
  /** The applied code (null = show the field). */
  quote: DiscountQuote | null;
  /** Thai message for the code (null = none). */
  error: string | null;
  applying: boolean;
  /** The checkout is running: the code cannot change. */
  disabled: boolean;
  onApply: () => void;
  onRemove: () => void;
}

/** "โค้ดส่วนลด": type a code and apply it, or show the applied code with a remove (×). */
export function DiscountCodeCard({
  code,
  onCodeChange,
  quote,
  error,
  applying,
  disabled,
  onApply,
  onRemove,
}: DiscountCodeCardProps) {
  const cardRef = useRef<HTMLElement>(null);

  // A failed checkout returns here from the bottom of the screen: show the message.
  useEffect(() => {
    if (!error) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    cardRef.current?.scrollIntoView?.({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [error]);

  const message = error ? (
    <p id={ERROR_ID} role="alert" className="mt-2 flex items-start gap-1.5 text-sm leading-[1.6] text-danger-fg">
      <AlertCircle aria-hidden="true" className="mt-[3px] size-4 shrink-0" />
      <ThaiText text={error} className="min-w-0" />
    </p>
  ) : null;

  if (quote) {
    return (
      <section ref={cardRef} aria-labelledby="payment-discount-title" className={cardClass}>
        <h2 id="payment-discount-title" className="font-heading text-[15px] leading-[1.4] font-semibold text-fg">
          {t("payment.discount.title")}
        </h2>
        {/* Applied: success tone + ticket icon + the words, never colour alone. */}
        <div className="mt-2 flex items-center gap-3 rounded-[var(--radius-tile)] border-[1.5px] border-success-border bg-success-bg py-1.5 pr-1 pl-3.5">
          <TicketPercent aria-hidden="true" className="size-6 shrink-0 text-success-fg" strokeWidth={2.1} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-base leading-[1.5] font-semibold tracking-wider break-all text-fg">{quote.code}</p>
            <p className="text-sm leading-[1.6] text-success-fg">
              {t("payment.discount.applied")} · {t("payment.discount.savePrefix")}{" "}
              <span className="font-semibold tabular-nums">{formatSatang(quote.discountSatang)}</span>
            </p>
          </div>
          <IconButton icon={X} label={t("payment.discount.remove")} disabled={disabled} onClick={onRemove} />
        </div>
        {message}
      </section>
    );
  }

  return (
    <section ref={cardRef} className={cardClass}>
      <form
        className="flex items-end gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && !applying && code.trim()) onApply();
        }}
      >
        <TextField
          id={INPUT_ID}
          label={t("payment.discount.title")}
          placeholder={t("payment.discount.placeholder")}
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
          className="min-w-0 flex-1"
          inputClassName="font-mono tracking-wider uppercase"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={32}
          disabled={disabled}
          // The message sits under the whole row (not inside the field) so the button lines up.
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ERROR_ID : undefined}
        />
        <Button
          type="submit"
          variant="brandSoft"
          size="touch"
          className="mb-[3px] h-[49px] rounded-[var(--radius-field)] px-5"
          disabled={disabled || !code.trim()}
          loading={applying}
        >
          {t("payment.discount.apply")}
        </Button>
      </form>
      {message}
    </section>
  );
}
