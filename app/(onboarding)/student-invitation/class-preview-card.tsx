/* eslint-disable @next/next/no-img-element */
"use client"

import React, { Fragment, useState } from "react"
import { useRouter } from "next/navigation"
import { Class, Tutor } from "@prisma/client"
import { CircleDollarSign } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Icons } from "@/components/icons"

interface ClassPreviewCardProps {
  classData: Class & {
    tutor: Tutor & {
      user: {
        name: string | null
      }
    }
  }
}

export default function ClassPreviewCard({ classData }: ClassPreviewCardProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleCheckout = async () => {
    setIsLoading(true)

    try {
      const response = await fetch("/api/v1/enrollments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          classId: classData.id,
          autoRenew: false,
        }),
      })
      const result = await response.json()
      console.log("Checkout result:", result)

      if (result.url) router.push(result.url)
      if (result.status === 400) {
        toast.error(
          "ไม่สามารถเข้าร่วมชั้นเรียนนี้ได้ เนื่องจากมีการลงทะเบียนแล้ว"
        )
        router.push(`/student/classes/${classData.id}`)
      }
      if (result.status === 404) {
        toast.error("ไม่พบชั้นเรียนนี้ กรุณาตรวจสอบอีกครั้ง")
      }
    } catch (error) {
      console.error("Checkout error:", error)
      toast.error("เกิดข้อผิดพลาดในการชำระเงิน กรุณาลองใหม่อีกครั้ง")
    } finally {
      setIsLoading(false)
    }
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Icons.star
        key={i}
        className={`size-4 ${i < rating ? "text-yellow-500" : "text-gray-300"}`}
      />
    ))
  }

  return (
    <Fragment>
      <CardContent>
        <Card className="text-sm p-0">
          <img
            src={
              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnPdud_AmDXuM63D4VZCsi7EjN3lujKro8mQ&s"
            }
            alt={classData.name}
            className="w-full h-[10rem] rounded-t-xl object-cover"
          />
          <CardContent className="p-3 pt-0">
            <p className="font-bold text-lg">{classData.name}</p>
            <p className="text-muted-foreground">
              สอนโดย {classData.tutor.user.name}
            </p>
            <div className="flex items-center mt-2">
              {renderStars(5)}
              <span className="ml-2 text-sm text-muted-foreground">
                {5} ({100} รีวิว)
              </span>
            </div>
            <div className="flex items-center mt-2 gap-2">
              <p className="text-lg">
                ฿{classData.packagePrice?.toLocaleString()}
              </p>
              {classData.packagePrice?.toLocaleString() && (
                <p className="text-sm line-through text-muted-foreground">
                  ฿{classData.packagePrice?.toLocaleString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={handleCheckout}
          disabled={isLoading}
        >
          {isLoading ? (
            <Icons.spinner className="animate-spin size-4" />
          ) : (
            <CircleDollarSign className="size-4" />
          )}
          {isLoading ? "กำลังดำเนินการ..." : "ชำระเงินเพื่อเข้าร่วม"}
        </Button>
      </CardFooter>
    </Fragment>
  )
}
