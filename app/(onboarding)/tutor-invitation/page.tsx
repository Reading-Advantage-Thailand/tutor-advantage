import { auth } from "@/lib/auth"
import TutorInvitationForm from "./tutor-invitation-form"
import { Role } from "@prisma/client"
import { notFound, redirect } from "next/navigation"
import { getTutorInvite } from "@/db/queries/tutor"

export default async function TutorInvitationPage() {
  const session = await auth()
  if (session?.user.role !== Role.TUTOR) return notFound()
  const invitation = await getTutorInvite(session?.user.id)
  if (!invitation) redirect("/tutor/classes/create")
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-6">
          <TutorInvitationForm />
        </div>
      </div>
    </div>
  )
}