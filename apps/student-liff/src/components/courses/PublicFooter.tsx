import Link from "next/link";
import { BusinessContactCard } from "@/components/legal/BusinessContactCard";

const linkClass =
  "flex min-h-11 items-center rounded-[var(--radius-ctl-sm)] px-3 font-heading text-sm leading-[1.4] font-semibold text-fg-muted active:bg-press";

/** Contact card + the public pages' links (44px tall each). Server-compatible. */
export function PublicFooter() {
  return <footer className="mt-8 space-y-3">
    <BusinessContactCard />
    <nav className="flex flex-wrap justify-center gap-x-2 gap-y-1" aria-label="ข้อมูลบริการ">
      <Link className={linkClass} href="/">หน้าแรก</Link><Link className={linkClass} href="/courses">คลาสเรียน</Link><Link className={linkClass} href="/terms">เงื่อนไขและคืนเงิน</Link><Link className={linkClass} href="/privacy">ความเป็นส่วนตัว</Link>
    </nav>
  </footer>;
}
