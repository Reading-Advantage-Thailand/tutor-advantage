import * as React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator,
} from "@/components/ui/sidebar"

import { InviteCreateButton } from "../invite-create-button"

export function SidebarRight({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 hidden h-svh border-l lg:flex"
      {...props}
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>คำเชิญ</SidebarGroupLabel>
          <InviteCreateButton
            className="justify-start w-full"
            size="sm"
            variant="secondary"
          />
        </SidebarGroup>
        <SidebarSeparator className="mx-0" />
      </SidebarContent>
    </Sidebar>
  )
}
