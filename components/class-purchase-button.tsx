"use client"

import { Button } from "@/components/ui/button"
import { useState } from "react"
import { toast } from "sonner"
import { handleClientError } from "@/lib/error-mapper"

interface ClassPurchaseButtonProps {
  classId: string
  price: number
  isEnrolled: boolean
}

export function ClassPurchaseButton({ classId, price, isEnrolled }: ClassPurchaseButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handlePurchase = async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ classId }),
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

  if (isEnrolled) {
    return (
      <Button disabled className="w-full">
        ลงทะเบียนแล้ว
      </Button>
    )
  }

  return (
    <Button
      onClick={handlePurchase}
      disabled={isLoading || price === 0}
      className="w-full"
    >
      {isLoading ? "กำลังดำเนินการ..." : `ซื้อคอร์ส ${price} บาท`}
    </Button>
  )
}