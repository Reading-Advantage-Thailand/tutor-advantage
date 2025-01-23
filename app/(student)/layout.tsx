import React from "react"
import { redirect } from "next/navigation"
import { Role } from "@prisma/client"

import { getClasses } from "@/lib/fetchers/get-classes"
import { mapClassesToSidebarNav } from "@/lib/mappers/map-classes-to-sidebar-nav"
import { getCurrentUser } from "@/lib/session"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import ClassJoinDialog from "@/components/student/class-join-dialog"

type StudentLayoutProps = {
  children?: React.ReactNode
}

export default async function StudentLayout({ children }: StudentLayoutProps) {
  const user = await getCurrentUser()
  if (!user) return redirect("/login")
  if (user.role !== Role.STUDENT) return redirect("/role")
  const classes = await getClasses({ userId: user.id as string })
  return (
    <SidebarProvider>
      <AppSidebar
        navmain={mapClassesToSidebarNav({ role: user.role }, classes)}
        user={{
          name: user.name as string,
          email: user.email as string,
          image: user.image as string,
          role: user.role as Role,
        }}
      />
      <ClassJoinDialog open={classes.length === 0} />
      {children}
    </SidebarProvider>
  )
}
