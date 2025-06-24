import { notFound } from "next/navigation"
import { getClasses, getClassNameById } from "@/db/queries/class"
import { Role } from "@prisma/client"

import { auth } from "@/lib/auth"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import AppSidebarPath from "@/components/app-sidebar-path"

interface StudentLayoutProps {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

export default async function StudentLayout({
  children,
  params,
}: StudentLayoutProps) {
  const { id: classId } = await params
  const session = await auth()
  if (!session || session.user.role !== Role.STUDENT) return notFound()
  const classes = await getClasses(session)
  const className = getClassNameById(classes, classId)
  return (
    <SidebarProvider>
      <AppSidebar user={session.user} data={classes} role={session.user.role} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <AppSidebarPath className={className} role={session.user.role} />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
