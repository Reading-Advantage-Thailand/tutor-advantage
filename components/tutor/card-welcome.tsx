import React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import ClassCreateButton from "./class-create-button"

export default function CardWelcome() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ยินดีต้อนรับ!</CardTitle>
        <CardDescription>
          ดูเหมือนว่าคุณยังไม่ได้สร้างห้องเรียนใด ๆ ในขณะนี้
          คุณสามารถสร้างห้องเรียนใหม่ได้ที่นี่
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-4">
        <ClassCreateButton />
        <Button variant="secondary" disabled>
          กรอกรหัสคำเชิญของห้องเรียน
        </Button>
      </CardContent>
    </Card>
  )
}
