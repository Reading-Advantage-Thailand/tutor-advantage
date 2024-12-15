"use client"

import React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { toast } from "@/hooks/use-toast"
import { Button, buttonVariants } from "@/components/ui/button"
import { Icons } from "@/components/shared/icons"

type InviteButtonProps = {
  code: string
}

export default function InviteButton({ code }: InviteButtonProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const router = useRouter()

  async function onAccept() {
    setIsLoading(true)
    const response = await fetch(`/api/v1/tutor/code/${code}`, {
      method: "POST",
    })

    const data = await response.json()
    switch (response.status) {
      case 200:
        toast({
          title: "เรียบร้อย",
          description: "คุณได้ตอบรับคำเชิญเรียบร้อยแล้ว",
        })
        router.push("/tutor/classes")
        break
      case 400:
        toast({
          title: "เกิดข้อผิดพลาด",
          description: data.message,
          variant: "destructive",
        })
        break
      case 404:
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่พบคำเชิญ",
          variant: "destructive",
        })
        break
      default:
        toast({
          title: "เกิดข้อผิดพลาด",
          description: "ไม่สามารถตอบรับคำเชิญได้",
          variant: "destructive",
        })
    }
    setIsLoading(false)
  }

  return (
    <div className="flex justify-center space-x-4">
      <Link href="/invite" className={buttonVariants({ variant: "outline" })}>
        <Icons.chevronLeft className="mr-2 size-4" />
        กลับไปหน้าเชิญ
      </Link>
      <Button onClick={onAccept} disabled={isLoading}>
        {isLoading && <Icons.spinner className="mr-2 animate-spin" />}
        ตอบรับคำเชิญ
      </Button>
    </div>
  )
}
