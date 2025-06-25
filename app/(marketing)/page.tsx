import Link from "next/link"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export const metadata = {
  title: "Tutor Advantage",
  description: "Tutor Advantage",
}

export default async function MarketingPage() {
  return (
    <section className="relative flex flex-col lg:flex-row px-8 pt-40 max-w-7xl mx-auto mt-[min(2vw,13rem)] mb-20">
      <div className="flex-1">
        <div className="relative max-w-[75rem] w-[calc(120%-0.5rem)] h-auto">
          <h1 className="max-w-[11ch] text-[clamp(2.5rem,10vw,6rem)] leading-[clamp(2.8rem,10vw,6.5rem)] font-bold tracking-tight text-primary mix-blend-color-burn opacity-90">
            พร้อมสำหรับการเริ่มต้นใหม่ <br />
            Tutor Advantage
          </h1>
          <p className="absolute top-0 left-0 max-w-[11ch] text-[clamp(2.5rem,10vw,6rem)] leading-[clamp(2.8rem,10vw,6.5rem)] font-bold tracking-tight text-primary opacity-50 -z-10">
            พร้อมสำหรับการเริ่มต้นใหม่ <br />
            Tutor Advantage
          </p>
          <p className="absolute top-0 left-0 max-w-[11ch] text-[clamp(2.5rem,10vw,6rem)] leading-[clamp(2.8rem,10vw,6.5rem)] font-bold tracking-tight text-primary opacity-10 mix-blend-multiply">
            พร้อมสำหรับการเริ่มต้นใหม่ <br />
            Tutor Advantage
          </p>
        </div>

        <div className="my-12 max-w-[60rem] w-[calc(100%-0.5rem)]">
          <p className="text-primary text-lg font-medium leading-relaxed tracking-wide">
            แพลตฟอร์มที่ออกแบบมาเพื่อช่วยให้คุณเริ่มต้นการเรียนการสอนออนไลน์ได้อย่างง่ายดาย
            ด้วยเครื่องมือที่ครบครันและใช้งานง่าย เข้าร่วมชั้นเรียนออนไลน์ของเรา
            และเริ่มสร้างรายได้จากการสอนของคุณได้ทันที
          </p>
        </div>
        <div className="my-12 max-w-[55rem] w-[calc(100%-0.5rem)] flex gap-6">
          <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
            เริ่มต้นใช้งาน
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            ติดต่อฝ่ายสนับสนุน
          </Link>
        </div>
      </div>
    </section>
  )
}
