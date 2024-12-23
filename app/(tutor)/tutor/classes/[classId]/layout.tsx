import React from "react"

import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { NavActions } from "@/components/tutor/nav-actions"
import NavPath from "@/components/tutor/nav-path"

type TutorClassProps = {
  children?: React.ReactNode
}

export default function TutorClassesLayout({ children }: TutorClassProps) {
  return (
    <SidebarInset>
      <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2">
        <div className="flex flex-1 items-center gap-2 px-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <NavPath />
        </div>
        <div className="ml-auto px-3">
          <NavActions />
        </div>
      </header>
      {children}
    </SidebarInset>
  )
}
