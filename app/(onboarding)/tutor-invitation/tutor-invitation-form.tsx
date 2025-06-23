"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { handleClientError } from "@/lib/error-mapper"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Icons } from "@/components/icons"

export default function TutorInvitationForm() {
  const router = useRouter()
  const [inviteCode, setInviteCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const submitInviteCode = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/v1/tutors/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: inviteCode || undefined }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (data.status === 404) throw new Error("Not Found")
        throw new Error(data.message)
      }
      toast.success("ยินดีต้อนรับเข้าสู่ระบบ")
      router.push("/tutor/classes/create")
    } catch (error) {
      if (error instanceof Error && error.message === "Not Found") {
        toast.error("ไม่พบรหัสเชิญนี้ กรุณาตรวจสอบอีกครั้ง")
      } else {
        toast.error(handleClientError(error))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submitInviteCode()
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">ยินดีต้อนรับครูผู้สอน</CardTitle>
        <CardDescription>
          กรอกรหัสเชิญเพื่อเริ่มต้นใช้งาน หรือดำเนินการต่อโดยไม่ต้องกรอกรหัส
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="รหัสเชิญ (ไม่บังคับ)"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            disabled={isLoading}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Icons.spinner className="animate-spin size-4" />}
            {isLoading ? "กำลังดำเนินการ..." : "ดำเนินการต่อ"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
