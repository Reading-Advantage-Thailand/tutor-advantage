import React from "react"
import { notFound } from "next/navigation"
import { getClassById } from "@/db/queries/class"
import { Role } from "@prisma/client"

import { auth } from "@/lib/auth"

type StudentClassesPageProps = {
  params: Promise<{ id: string }>
}

export default async function StudentClassesPage({
  params,
}: StudentClassesPageProps) {
  const { id } = await params
  const session = await auth()
  if (session?.user.role !== Role.STUDENT) return notFound()
  const classData = await getClassById(id, session.user.id)
  if (!classData) return notFound()
  console.log("Class Data:", classData)
  return (
    <div className="m-4 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">ชั้นเรียน: {classData?.name}</h1>
      <p className="text-muted-foreground">
        รหัสห้องเรียน: {classData?.inviteCode}
      </p>
      <p className="text-muted-foreground">
        จำนวนชั่วโมงเรียน: {classData?.defaultHours} ชั่วโมง
      </p>
    </div>
  )
}
