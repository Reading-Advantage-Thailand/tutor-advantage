import { checkoutPolicy } from "@/lib/content/legal";

export function PaymentPolicyNotice({ accepted, onAcceptedChange }: { accepted?: boolean; onAcceptedChange?: (value: boolean) => void }) {
  return <section className="space-y-3 rounded-2xl border border-hairline bg-surface p-4 text-sm leading-relaxed text-fg" aria-label="เงื่อนไขก่อนชำระเงิน">
    <h2 className="font-bold">การส่งมอบ การยกเลิก และคืนเงิน</h2>
    <p>{checkoutPolicy.deliverySummary}</p><p>{checkoutPolicy.cancellation}</p><p>{checkoutPolicy.refund}</p>
    <details className="text-fg-muted"><summary className="cursor-pointer py-2 font-semibold">การคืนหนังสือ ช่องทางขอคืนเงิน และระยะเวลาดำเนินการ</summary><p>{checkoutPolicy.bookReturn}</p><p className="mt-2">{checkoutPolicy.process}</p><p className="mt-2">{checkoutPolicy.paymentRefund}</p></details>
    <p className="text-xs text-fg-muted">{checkoutPolicy.lastUpdated}</p>
    <p><a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-brand-fg underline">เงื่อนไขฉบับเต็ม</a>{" · "}<a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold text-brand-fg underline">ความเป็นส่วนตัว</a></p>
    {onAcceptedChange ? <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-fill-muted p-3">
      <input type="checkbox" className="mt-1 size-5 shrink-0 accent-green-700" checked={accepted ?? false} onChange={(event) => onAcceptedChange(event.target.checked)} />
      <span>ฉันได้อ่านและยอมรับเงื่อนไขการส่งมอบ การยกเลิกและคืนเงินข้างต้นแล้ว</span>
    </label> : null}
  </section>;
}
