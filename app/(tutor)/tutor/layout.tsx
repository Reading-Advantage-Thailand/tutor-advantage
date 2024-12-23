import { headers } from "next/headers"
import { redirect } from "next/navigation"

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

const navprojects = [
  {
    name: "การเชิญ",
    url: "/tutor/invites",
    icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS11c2Vycy1yb3VuZCI+PHBhdGggZD0iTTE4IDIxYTggOCAwIDAgMC0xNiAwIi8+PGNpcmNsZSBjeD0iMTAiIGN5PSI4IiByPSI1Ii8+PHBhdGggZD0iTTIyIDIwYzAtMy4zNy0yLTYuNS00LThhNSA1IDAgMCAwLS40NS04LjMiLz48L3N2Zz4=",
  },
]

export default async function TutorLayout({ children }: TutorLayoutProps) {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  const data = await fetchTutorClasses()

  return (
    <SidebarProvider>
      <AppSidebar
        role={user.role}
        navmain={data.classes}
        title={"ห้องเรียน"}
        user={{
          name: user.name ?? "",
          email: user.email ?? "",
          avatar: user.image ?? "",
        }}
        navprojects={navprojects}
      />
      {children}
    </SidebarProvider>
  )
}
