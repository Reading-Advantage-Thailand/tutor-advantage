"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, TicketPercent, X } from "lucide-react";
import { IconButton, TextField } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { DiscountQuote } from "@/lib/paymentFlow";

const INPUT_ID = "input-discount-code";
const ERROR_ID = `${INPUT_ID}-error`;

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
    if (error) cardRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [error]);

  const message = error ? (
    <p id={ERROR_ID} role="alert" className="mt-1.5 flex items-start gap-1 text-[13px] leading-[1.5] text-danger-fg">
      <AlertCircle aria-hidden="true" className="mt-[3px] size-3.5 shrink-0" />
      <span>{error}</span>
    </p>
  ) : null;

  if (quote) {
    return (
      <section
        ref={cardRef}
        aria-labelledby="payment-discount-title"
        className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]"
      >
        <h2 id="payment-discount-title" className="text-sm leading-[1.5] font-semibold text-fg">
          {t("payment.discount.title")}
        </h2>
        <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-success-border bg-success-bg py-1 pr-1 pl-3.5">
          <TicketPercent aria-hidden="true" className="size-5 shrink-0 text-success-fg" strokeWidth={2.2} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[15px] leading-[1.5] font-bold tracking-wider break-all text-fg">{quote.code}</p>
            <p className="text-[13px] leading-[1.5] text-success-fg">
              {t("payment.discount.applied")} · {t("payment.discount.savePrefix")} {formatSatang(quote.discountSatang)}
            </p>
          </div>
          <IconButton icon={X} label={t("payment.discount.remove")} disabled={disabled} onClick={onRemove} />
        </div>
        {message}
      </section>
    );
  }

  return (
    <section
      ref={cardRef}
      className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]"
    >
      <form
        className="flex items-end gap-2"
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
          className="h-12"
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
