import React from "react"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Badge } from "../ui/badge"

export default function CardNews() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          ฟีเจอร์ใหม่: สร้างห้องเรียนใหม่ได้แล้ว!{" "}
          <Badge className="ml-2 bg-green-700 hover:bg-green-800">ใหม่!</Badge>
        </CardTitle>
        <CardDescription>
          สร้างห้องเรียนใหม่ได้แล้ว สามารถเข้าร่วมห้องเรียนใหม่ได้ทันที
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
