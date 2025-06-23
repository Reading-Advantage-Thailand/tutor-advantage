import React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getClasses } from "@/db/queries/class"
import { Role } from "@prisma/client"

import { auth } from "@/lib/auth"
import { Label } from "@/components/ui/label"

export default async function TutorClassesPage() {
  const session = await auth()
  if (session?.user.role !== Role.TUTOR) return notFound()
  const classes = await getClasses(session)
  console.log("Classes:", classes)
  return (
    <div className="m-4 flex flex-col gap-4">
      <Label>ประกาศชั้นเรียน</Label>
      <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-4">
        <div className="space-y-0.5">
          <Label>ประกาศชั้นเรียน</Label>
          <p className="text-sm text-muted-foreground">
            ประกาศชั้นเรียนจะถูกแสดงที่นี่ หากมีประกาศใหม่จากคุณครู
          </p>
        </div>
      </div>
      <Label>ชั้นเรียนที่คุณสอน</Label>
      <div className="grid gap-4">
        {classes.length > 0 ? (
          classes.map((classItem) => (
            <Link
              key={classItem.id}
              href={`/tutor/classes/${classItem.id}`}
              className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm gap-4 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <div className="space-y-0.5">
                <Label>{classItem.name}</Label>
                <p className="text-sm text-muted-foreground">
                  จำนวนชัวโมงเรียน: {classItem.defaultHours} ชั่วโมง
                </p>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-muted-foreground">
            คุณยังไม่ได้เข้าร่วมชั้นเรียนใด ๆ
          </p>
        )}
      </div>
    </div>
  )
}
