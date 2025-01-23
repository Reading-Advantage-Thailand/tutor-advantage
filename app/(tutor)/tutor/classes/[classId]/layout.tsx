import React from "react"
import { headers } from "next/headers"

import { env } from "@/env.mjs"
import { getClassInviteCode } from "@/lib/fetchers/get-class-invite-code"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { NavActions } from "@/components/tutor/nav-actions"
import NavPath from "@/components/tutor/nav-path"
import { ClassMember, SidebarClass } from "@/components/tutor/sidebar-class"

type TutorClassProps = {
  children?: React.ReactNode
  params: {
    classId: string
  }
}

async function fetchMembers({
  classId,
}: {
  classId: string
}): Promise<ClassMember> {
  const response = await fetch(
    `${env.NEXT_PUBLIC_APP_URL}/api/v1/classes/${classId}/members`,
    { headers: await headers() }
  )
  if (!response.ok) throw new Error("Failed to get members")
  return await response.json()
}

export default async function TutorClassesLayout({
  children,
  params,
}: TutorClassProps) {
  const { classId } = await params
  const members = await fetchMembers({ classId })
  const inviteCode = await getClassInviteCode({ classId })
  return (
    <>
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
      <SidebarClass classMembers={members} code={inviteCode?.code} />
    </>
  )
}
