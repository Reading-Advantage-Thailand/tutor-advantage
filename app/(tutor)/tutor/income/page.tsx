"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { handleClientError } from "@/lib/error-mapper"
import { PaymentStatus } from "@prisma/client"

interface Payment {
  id: string
  amount: number
  currency: string
  status: PaymentStatus
  description: string | null
  receiptUrl: string | null
  createdAt: string
  enrollment: {
    class: {
      name: string
    }
    student: {
      user: {
        name: string
      }
    }
  }
}

export default function TutorIncomePage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const response = await fetch("/api/v1/tutors/payments")
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.message)
        }
        const data = await response.json()
        setPayments(data)
      } catch (error) {
        console.error(error)
        const errorMessage = handleClientError(error)
        toast.error(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPayments()
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
        <div className="flex w-full max-w-lg flex-col gap-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">
                กำลังโหลด...
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  const totalIncome = payments
    .filter(p => p.status === PaymentStatus.PAID)
    .reduce((sum, p) => sum + p.amount, 0)

  const pendingPayments = payments
    .filter(p => p.status === PaymentStatus.PENDING)
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-4xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>รายได้ของติวเตอร์</CardTitle>
            <CardDescription>
              <div className="grid gap-2">
                <p>รายได้รวม: {totalIncome.toLocaleString()} บาท</p>
                {pendingPayments > 0 && (
                  <p>รอการชำระเงิน: {pendingPayments.toLocaleString()} บาท</p>
                )}
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {payments.map((payment) => (
                <Card key={payment.id}>
                  <CardContent className="p-4">
                    <div className="grid gap-2">
                      <div className="flex justify-between">
                        <p className="font-medium">
                          {payment.enrollment.class.name}
                        </p>
                        <p className="text-muted-foreground">
                          {new Date(payment.createdAt).toLocaleDateString("th-TH")}
                        </p>
                      </div>
                      <div className="grid gap-1 text-sm text-muted-foreground">
                        <p>นักเรียน: {payment.enrollment.student.user.name}</p>
                        <p>จำนวนเงิน: {payment.amount.toLocaleString()} บาท</p>
                        <p>สถานะ: {
                          payment.status === PaymentStatus.PAID ? "ชำระเงินแล้ว" :
                            payment.status === PaymentStatus.PENDING ? "รอการชำระเงิน" :
                              payment.status === PaymentStatus.FAILED ? "ชำระเงินไม่สำเร็จ" :
                                "คืนเงินแล้ว"
                        }</p>
                        {payment.receiptUrl && (
                          <a
                            href={payment.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            ดูใบเสร็จ
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 