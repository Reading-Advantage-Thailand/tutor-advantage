import Link from "next/link";
import { BusinessContactCard } from "@/components/legal/BusinessContactCard";

export function PublicFooter() {
  return <footer className="mt-8 space-y-4">
    <BusinessContactCard />
    <nav className="flex flex-wrap justify-center gap-6 text-sm text-fg-muted" aria-label="ข้อมูลบริการ">
      <Link className="py-3" href="/">หน้าแรก</Link><Link className="py-3" href="/courses">คลาสเรียน</Link><Link className="py-3" href="/terms">เงื่อนไขและคืนเงิน</Link><Link className="py-3" href="/privacy">ความเป็นส่วนตัว</Link>
    </nav>
  </footer>;
}
