"use client"

import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  let errorMessage = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"
  let errorDescription = "กรุณาลองใหม่อีกครั้ง"

  switch (error) {
    case "AccessDenied":
      errorMessage = "ไม่สามารถเข้าสู่ระบบได้"
      errorDescription = "กรุณาเลือกประเภทผู้ใช้งานก่อนเข้าสู่ระบบ"
      break
    case "Configuration":
      errorMessage = "เกิดข้อผิดพลาดในการตั้งค่าระบบ"
      errorDescription = "กรุณาติดต่อผู้ดูแลระบบ"
      break
    case "Verification":
      errorMessage = "การยืนยันตัวตนล้มเหลว"
      errorDescription = "กรุณาลองใหม่อีกครั้ง"
      break
    default:
      errorMessage = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ"
      errorDescription = "กรุณาลองใหม่อีกครั้ง"
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{errorMessage}</CardTitle>
            <CardDescription>{errorDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild>
              <Link href="/login">กลับไปหน้าเข้าสู่ระบบ</Link>
            </Button>
            {error === "AccessDenied" && (
              <Button variant="outline" asChild>
                <Link href="/select-role">เลือกประเภทผู้ใช้งาน</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 