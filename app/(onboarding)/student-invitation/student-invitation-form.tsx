"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { handleClientError } from "@/lib/error-mapper"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Icons } from "@/components/icons"

export default function StudentInvitationForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialInviteCode = searchParams.get("inviteCode") || ""
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [isLoading, setIsLoading] = useState(false)

  const submitInviteCode = async () => {
    setIsLoading(true)
    try {
      if (!inviteCode) return
      router.replace(`?inviteCode=${encodeURIComponent(inviteCode)}`)
      toast.success("กำลังตรวจสอบรหัสเชิญ...")
      // router.push("/student/classes")
    } catch (error) {
      console.error("Error submitting invite code:", error)
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
    <CardContent>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          placeholder="รหัสห้องเรียน"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          disabled={isLoading}
          required
        />
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || !inviteCode.trim()}
        >
          {isLoading && <Icons.spinner className="animate-spin size-4" />}
          {isLoading ? "กำลังดำเนินการ..." : "ดำเนินการต่อ"}
        </Button>
      </form>
    </CardContent>
  )
}
