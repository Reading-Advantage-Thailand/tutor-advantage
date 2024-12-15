import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { EmptyPlaceholder } from "@/components/shared/empty-placehoulder"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <EmptyPlaceholder.Icon name="warning" />
      <EmptyPlaceholder.Title>โอ๊ะ! ไม่พบรหัสเชิญ</EmptyPlaceholder.Title>
      <EmptyPlaceholder.Description>
        คำเชิญที่คุณพยายามเข้าถึงอาจถูกลบไปแล้วหรือไม่มีอยู่
        กรุณาตรวจสอบอีกครั้ง
      </EmptyPlaceholder.Description>
      <Link href="/invite" className={buttonVariants({ variant: "outline" })}>
        <ChevronLeft className="mr-2 size-4" />
        กลับไปหน้าเชิญ
      </Link>
    </div>
  )
}
