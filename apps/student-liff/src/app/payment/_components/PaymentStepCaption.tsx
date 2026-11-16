import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The checkout in three stages: 1 order + method, 2 check and pay, 3 result. */
export const PAYMENT_STEP_TOTAL = 3;

export interface PaymentStepCaptionProps {
  step: 1 | 2 | 3;
  className?: string;
}

/**
 * "ขั้นที่ 2 จาก 3" under the checkout app bar (patterns.md S12): a t-caption
 * line with a three-segment track. The track is decorative; the words carry
 * the meaning. Server-compatible.
 */
export function PaymentStepCaption({ step, className }: PaymentStepCaptionProps) {
  return (
    <div className={cn("flex items-center gap-3 px-4 pt-3", className)}>
      <p className="t-caption shrink-0 text-fg-muted tabular-nums">
        {t("payment.steps.prefix")} {step} {t("payment.steps.of")} {PAYMENT_STEP_TOTAL}
      </p>
      <span aria-hidden="true" className="flex flex-1 gap-1">
        {Array.from({ length: PAYMENT_STEP_TOTAL }, (_, index) => (
          <span
            key={index}
            className={cn("h-1.5 flex-1 rounded-full", index < step ? "bg-brand-vivid" : "bg-track")}
          />
        ))}
      </span>
    </div>
  );
}
