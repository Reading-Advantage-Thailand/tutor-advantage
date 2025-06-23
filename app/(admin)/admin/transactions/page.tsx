import { headers } from "next/headers"
import Link from "next/link"

import { env } from "@/env.mjs"
// import { auth } from "@/lib/auth"
import { Label } from "@/components/ui/label"
import { PaymentResponse } from "@/app/api/v1/admin/payments/route"

async function getPaymentsAndClasses(): Promise<PaymentResponse> {
  const response = await fetch(
    `${env.NEXT_PUBLIC_APP_URL}/api/v1/admin/payments`,
    {
      headers: await headers(),
      cache: "no-store",
    }
  )
  if (!response.ok) {
    throw new Error("Failed to fetch payments and classes")
  }
  return response.json()
}

export default async function AdminTransactionsPage() {
  // const session = await auth()
  // if (session?.user?.role !== Role.ADMIN) return notFound()
  const { payments, classes, totalRevenue } = await getPaymentsAndClasses()
  return (
    <div className="m-4 flex flex-col gap-4">
      <Label>รายการธุรกรรม</Label>
      <div className="flex flex-row gap-4">
        <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-4">
          <div className="space-y-0.5">
            <Label>จำนวนรายได้ทั้งหมด</Label>
            <p className="text-sm text-muted-foreground">{totalRevenue} บาท</p>
          </div>
        </div>
        <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-4">
          <div className="space-y-0.5">
            <Label>จำนวนห้องเรียนทั้งหมด</Label>
            <p className="text-sm text-muted-foreground">
              {classes.length} ห้องเรียน
            </p>
          </div>
        </div>
        <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-4">
          <div className="space-y-0.5">
            <Label>จำนวนธุรกรรมทั้งหมด</Label>
            <p className="text-sm text-muted-foreground">
              {payments.length} ธุรกรรม
            </p>
          </div>
        </div>
      </div>
      <Label>ห้องเรียนที่ถูกสร้างขึ้น</Label>
      <div className="grid gap-4">
        {classes.length > 0 ? (
          classes.map((classItem) => (
            <div
              key={classItem.id}
              className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-4 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <div className="space-y-0.5">
                <Label>{classItem.name}</Label>
                <p className="text-sm text-muted-foreground">
                  ผู้สอน: {classItem.tutor.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  นักเรียนที่เข้าร่วม: {classItem.students.length} คน
                </p>
                <p className="text-sm text-muted-foreground">
                  นักเรียนที่เข้าร่วมทั้งหมด:{" "}
                  {classItem.students
                    .map((s) => `${s.name} (${s.status})`)
                    .join(", ")}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">
            ยังไม่มีห้องเรียนใด ๆ ที่ถูกสร้างขึ้น
          </p>
        )}
      </div>
      <Label>รายการธุรกรรม</Label>
      <div className="grid gap-4">
        {payments.length > 0 ? (
          payments.map((payment) => (
            <div
              key={payment.id}
              className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-4 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <div className="space-y-0.5">
                <Label>ธุรกรรม ({payment.id})</Label>
                <p className="text-sm text-muted-foreground">
                  จำนวนเงิน: {payment.amount} {payment.currency}
                </p>
                <p className="text-sm text-muted-foreground">
                  สถานะ: {payment.status}
                </p>
                <p className="text-sm text-muted-foreground">
                  รายละเอียด: {payment.description}
                </p>
                <p className="text-sm text-muted-foreground">
                  วันที่ทำรายการ: {new Date(payment.createdAt).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  ห้องเรียน: {payment.enrollment.className}
                </p>
                <p className="text-sm text-muted-foreground">
                  ผู้สอน: {payment.enrollment.tutorName}
                </p>
                <p className="text-sm text-muted-foreground">
                  นักเรียน: {payment.enrollment.studentName}
                </p>
                {payment.receiptUrl && (
                  <Link
                    href={payment.receiptUrl}
                    className="text-blue-500 hover:underline"
                  >
                    ดูใบเสร็จรับเงิน
                  </Link>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">
            ยังไม่มีห้องเรียนใด ๆ ที่ถูกสร้างขึ้น
          </p>
        )}
      </div>
    </div>
  )
}
