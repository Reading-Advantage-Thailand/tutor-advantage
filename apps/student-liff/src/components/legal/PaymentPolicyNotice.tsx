import { checkoutPolicy } from "@/lib/content/legal";
import { cn } from "@/lib/utils";
import { keepThaiWords } from "../../lib/thaiText";

export interface PaymentPolicyNoticeProps {
  accepted?: boolean;
  onAcceptedChange?: (value: boolean) => void;
  /** Extra classes for the card (spacing in the page flow). */
  className?: string;
}

/**
 * Delivery, cancellation and refund terms shown before payment, as a container
 * card (components.md §3.1: 1.5px clay rim, card radius and shadow, 20px
 * padding like the other payment cards, Kodchasan title) with an optional
 * "I accept" checkbox. Server-compatible.
 */
export function PaymentPolicyNotice({ accepted, onAcceptedChange, className }: PaymentPolicyNoticeProps) {
  return <section className={cn("space-y-3 rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-5 text-sm leading-[1.6] text-fg shadow-[var(--shadow-card)]", className)} aria-label="เงื่อนไขก่อนชำระเงิน">
    <h2 className="t-title-s text-balance">{keepThaiWords("การส่งมอบ การยกเลิก และคืนเงิน")}</h2>
    <p className="text-pretty">{keepThaiWords(checkoutPolicy.deliverySummary)}</p><p className="text-pretty">{keepThaiWords(checkoutPolicy.cancellation)}</p><p className="text-pretty">{keepThaiWords(checkoutPolicy.refund)}</p>
    <details className="text-fg-muted"><summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-pretty">{keepThaiWords("การคืนหนังสือ ช่องทางขอคืนเงิน และระยะเวลาดำเนินการ")}</summary><p className="text-pretty">{keepThaiWords(checkoutPolicy.bookReturn)}</p><p className="mt-2 text-pretty">{keepThaiWords(checkoutPolicy.process)}</p><p className="mt-2 text-pretty">{keepThaiWords(checkoutPolicy.paymentRefund)}</p></details>
    <p className="text-xs leading-[1.6] text-fg-muted">{checkoutPolicy.lastUpdated}</p>
    <p className="-mx-1 flex flex-wrap items-center"><a href="/terms" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center px-1 font-semibold text-brand-fg underline">เงื่อนไขฉบับเต็ม</a><span aria-hidden="true" className="px-1">·</span><a href="/privacy" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center px-1 font-semibold text-brand-fg underline">ความเป็นส่วนตัว</a></p>
    {onAcceptedChange ? <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg bg-surface-muted p-3">
      <input type="checkbox" className="mt-0.5 size-6 shrink-0 accent-brand-solid" checked={accepted ?? false} onChange={(event) => onAcceptedChange(event.target.checked)} />
      <span className="text-pretty">{keepThaiWords("ฉันได้อ่านและยอมรับเงื่อนไขการส่งมอบ การยกเลิกและคืนเงินข้างต้นแล้ว")}</span>
    </label> : null}
  </section>;
}
