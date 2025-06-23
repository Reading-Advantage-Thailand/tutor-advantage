import React from "react"
import { notFound } from "next/navigation"
import { getClassById } from "@/db/queries/class"
import { Role } from "@prisma/client"
import { RefreshCcw } from "lucide-react"

import { auth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface TutorClassSettingsPageProps {
  params: Promise<{ id: string }>
}
export default async function TutorClassSettingsPage({
  params,
}: TutorClassSettingsPageProps) {
  const { id: classId } = await params
  const session = await auth()
  if (!session || session.user.role !== Role.TUTOR) return notFound()
  const data = await getClassById(classId, session.user.id)
  if (!data) return notFound()
  return (
    <Card className="m-4">
      <CardContent>
        <form className="grid gap-3">
          <Label htmlFor="invite-code">ชื่อห้องเรียน</Label>
          <Input
            id="invite-code"
            type="text"
            placeholder={data?.name}
            disabled
          />
          <div className="grid gap-2">
            <Label htmlFor="invite-code">รหัสห้องเรียน</Label>
            <div className="flex gap-2">
              <Input
                id="invite-code"
                type="text"
                placeholder={data?.inviteCode}
                disabled
                className="flex-1"
              />
              <Button variant="outline" className="shrink-0" disabled>
                <RefreshCcw className="h-4 w-4" />
                สร้างรหัสใหม่
              </Button>
            </div>
          </div>
          <Label>ปิดการเข้าร่วมชั้นเรียน</Label>
          <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-4">
            <div className="space-y-0.5">
              <Label>การต้งค่าการเข้าร่วมชั้นเรียน</Label>
              <p className="text-sm text-muted-foreground">
                เมื่อเปิดใช้งาน ผู้เรียนจะไม่สามารถเข้าร่วมชั้นเรียนได้อีกต่อไป
                หากต้องการให้ผู้เรียนเข้าร่วมชั้นเรียนได้อีกครั้ง
                ให้ปิดการตั้งค่านี้
              </p>
            </div>
            <Switch checked={false} disabled />
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
