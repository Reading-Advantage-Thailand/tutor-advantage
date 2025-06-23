import { notFound } from "next/navigation"
import { getClassMembers } from "@/db/queries/class"
import { Role } from "@prisma/client"

import { auth } from "@/lib/auth"
import { Label } from "@/components/ui/label"

import { columns } from "./columns"
import { DataTable } from "./data"

interface ClassMembersPageProps {
  params: Promise<{ id: string }>
}

export default async function TutorClassMembersPage({
  params,
}: ClassMembersPageProps) {
  const { id: classId } = await params
  const session = await auth()
  if (!session || session.user.role !== Role.STUDENT) return notFound()
  const classMembers = await getClassMembers(classId, session)
  return (
    <div className="m-4 flex flex-col gap-4">
      <Label>คุณครู</Label>
      <DataTable
        columns={columns}
        data={classMembers?.tutor ? [classMembers.tutor] : []}
      />
      <Label>รายชื่อสมาชิกในชั้นเรียน</Label>
      <DataTable columns={columns} data={classMembers?.students || []} />
    </div>
  )
}
