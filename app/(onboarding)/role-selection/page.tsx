import { auth } from "@/lib/auth"
import RoleSelectionForm from "./role-selection-form"
import { redirect } from "next/navigation"
import { Role } from "@prisma/client"

export default async function RoleSelectionPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role) redirect(session.user.role === Role.TUTOR ? "/tutor-invitation" : "/student-invitation")

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className={"flex flex-col gap-6"}>
          <RoleSelectionForm />
        </div >
      </div >
    </div >
  )
}