import React from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Badge } from "../ui/badge"

export default function CardTutorial() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          หากไม่ทราบวิธีการใช้งาน ลองดูวิดีโอสอนของเราสิ{" "}
          <Badge className="ml-2 bg-green-700 hover:bg-green-800">
            เหมาะสำหรับผู้ใช้ใหม่
          </Badge>
        </CardTitle>
        <CardDescription>
          ดูวิดีโอสอนเพื่อเรียนรู้วิธีการใช้งานเบื้องต้นของเว็บไซต์ของเรา
          และเริ่มต้นใช้งานได้ทันที โดยไม่ต้องมีความรู้พื้นฐานใด ๆ ลองดูเลย!
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <iframe
          src="https://www.youtube.com/embed/yKNxeF4KMsY?si=ArBPKw1OshJESs6D"
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="rounded-lg shadow-md w-full h-96"
        ></iframe>
      </CardContent>
    </Card>
  )
}
