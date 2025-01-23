import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Role } from "@prisma/client"

import { env } from "@/env.mjs"
import { getCurrentUser } from "@/lib/session"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/tutor/app-sidebar"
import { TutorClassesResponse } from "@/app/api/v1/classes/route"

interface TutorLayoutProps {
  children?: React.ReactNode
}

async function fetchTutorClasses(): Promise<TutorClassesResponse> {
  const response = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/v1/classes`, {
    headers: await headers(),
  })
  if (!response.ok) throw new Error("Failed to get classes")
  return await response.json()
}

export default async function TutorLayout({ children }: TutorLayoutProps) {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  if (user.role !== Role.TUTOR) return redirect("/role")
  const data = await fetchTutorClasses()

  return (
    <SidebarProvider>
      <AppSidebar
        navmain={{
          title: "ห้องเรียน",
          items: data.classes,
        }}
        user={{
          name: user.name ?? "",
          email: user.email ?? "",
          image: user.image ?? "",
          role: user.role ?? Role.GUEST,
        }}
      />
      {children}
    </SidebarProvider>
  )
}
