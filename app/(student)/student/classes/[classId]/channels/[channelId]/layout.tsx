import React, { Fragment } from "react"

import { getClassMembers } from "@/lib/fetchers/get-class-members"
import { mapClassMembers, Member } from "@/lib/mappers/map-class-members"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { NavActions } from "@/components/sidebar/nav-actions"
import { SidebarClass } from "@/components/sidebar/sidebar-class"
import NavPath from "@/components/tutor/nav-path"

type StudentClassLayoutProps = {
  children?: React.ReactNode
  params: Promise<{ classId: string; channelId: string }>
}

export default async function StudentClassLayout({
  children,
  params,
}: StudentClassLayoutProps) {
  const { classId } = await params
  const members = await getClassMembers({ classId: classId })
  return (
    <Fragment>
      <SidebarInset>
        <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <NavPath />
          </div>
          <div className="ml-auto px-3">
            <NavActions classId={classId} />
          </div>
        </header>
        {children}
      </SidebarInset>
      <SidebarClass classMembers={mapClassMembers(members as Member[])} />
    </Fragment>
  )
}
