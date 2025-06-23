"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"
import { toast } from "sonner"
import { handleClientError } from "@/lib/error-mapper"

interface ReEnrollButtonProps {
  enrollmentId: string
  price: number
}

export function ReEnrollButton({ enrollmentId, price }: ReEnrollButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleReEnroll = async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/v1/re-enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enrollmentId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message)
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error("ไม่พบ URL สำหรับการชำระเงิน")
      }
    } catch (error) {
      console.error(error)
      const errorMessage = handleClientError(error)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleReEnroll}
      disabled={isLoading}
      className="w-full"
    >
      {isLoading ? "กำลังดำเนินการ..." : `ลงทะเบียนใหม่ ${price} บาท`}
    </Button>
  )
} 