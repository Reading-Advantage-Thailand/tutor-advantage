import React from "react"
import { notFound } from "next/navigation"
import { getClassByInviteCode } from "@/db/queries/class"
import { Role } from "@prisma/client"

import { auth } from "@/lib/auth"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import ClassPreviewCard from "./class-preview-card"
import StudentInvitationForm from "./student-invitation-form"

interface StudentInvitationPageProps {
  searchParams: Promise<{ inviteCode?: string }>
}

export default async function StudentInvitationPage({
  searchParams,
}: StudentInvitationPageProps) {
  const session = await auth()
  if (
    session?.user.role !== Role.STUDENT &&
    session?.user.role !== Role.ADMIN
  ) {
    return notFound()
  }
  const inviteCode = await searchParams.then((params) => params.inviteCode)
  const classData = await getClassByInviteCode(inviteCode || "")
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">ค้นหาห้องเรียน</CardTitle>
              <CardDescription>เข้าร่วมชั้นเรียน</CardDescription>
            </CardHeader>
            {!classData && <StudentInvitationForm />}
            {classData && <ClassPreviewCard classData={classData} />}
          </Card>
        </div>
      </div>
    </div>
  )
}
