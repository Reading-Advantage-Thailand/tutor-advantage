import React from "react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function TutorNotFoundPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="max-w-3xl mx-auto w-full">
        <Card>
          <CardHeader>
            <CardTitle>ดูเหมือนว่าเราไม่พบเนื้อหาที่คุณกำลังมองหา</CardTitle>
            <CardDescription>
              ลองตรวจสอบ URL อีกครั้งหรือเราอาจจะได้ลบหน้านี้ไปแล้ว
              หากคุณมีข้อสงสัยใด ๆ โปรดติดต่อเรา
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
