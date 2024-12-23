import React from "react"

import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import NavPath from "@/components/tutor/nav-path"
import { SidebarInvites } from "@/components/tutor/sitebar-invites"

type TutorInvitesProps = {
  children?: React.ReactNode
}

export default function TutorInvitesLayout({ children }: TutorInvitesProps) {
  return (
    <>
      <SidebarInset>
        <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <NavPath />
          </div>
        </header>
        {children}
      </SidebarInset>
      <SidebarInvites />
    </>
  )
}
