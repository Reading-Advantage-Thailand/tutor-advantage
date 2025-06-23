"use client"

import * as React from "react"
import { mapToSidebar } from "@/mappers/sidebar-mapper"
import { Class, Role, User } from "@prisma/client"

import { siteConfig } from "@/config/site"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavMain, NavMainItem } from "@/components/nav-main"
import { NavProjectItem, NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"

import { Icons } from "./icons"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  data: Class[],
  role: Role,
  user: User,
}

export interface AppSidebarData {
  user: {
    name: string
    email: string
    avatar: string
  }
  navMain: NavMainItem[]
  projects: NavProjectItem[]
}

export function AppSidebar({ user, role, data, ...props }: AppSidebarProps) {
  const sidebarData = mapToSidebar(user, data, role)
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
            <Icons.logo className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{siteConfig.name}</span>
            <span className="truncate text-xs">
              ครูสอนพิเศษ
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebarData.navMain} />
        <NavProjects projects={sidebarData.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
