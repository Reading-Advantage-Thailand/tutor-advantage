import { redirect } from "next/navigation"
import { Role } from "@prisma/client"

import { auth } from "@/lib/auth"

export default async function Redirect() {
  const session = await auth()
  console.log("Session:", session)
  if (!session) return redirect("/login")
  if (session.user.role === null) return redirect("/role-selection")
  if (session.user.role === Role.STUDENT) {
    if (session.user.isOnboardingCompleted) {
      return redirect("/student/classes")
    }
    return redirect("/student-invitation")
  }
  if (session.user.role === Role.TUTOR) {
    if (session.user.isOnboardingCompleted) {
      return redirect("/tutor/classes")
    }
    return redirect("/tutor-invitation")
  }
  if (session.user.role === Role.ADMIN) return redirect("/admin/transactions")
  console.error("Unknown role:", session.user.role)
}
