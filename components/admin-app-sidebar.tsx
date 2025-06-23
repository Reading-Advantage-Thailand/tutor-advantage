"use client"

import * as React from "react"
import { User } from "@prisma/client"
import { LayoutDashboard } from "lucide-react"

import { siteConfig } from "@/config/site"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavProjectItem, NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"

import { Icons } from "./icons"

interface AdminAppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: User
}

export function AdminAppSidebar({ user, ...props }: AdminAppSidebarProps) {
  const adminNavItems: NavProjectItem[] = [
    {
      name: "ธรุกรรม",
      url: "/admin/transactions",
      icon: LayoutDashboard,
    },
  ]
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
            <span className="truncate text-xs">แอดมิน</span>
          </div>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        <NavProjects projects={adminNavItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user.name || "ผู้ใช้",
            email: user.email || "ไม่มีอีเมล",
            avatar: user.image || "",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
