"use client"

import * as React from "react"
import { Frame, Map, PieChart } from "lucide-react"

import { siteConfig } from "@/config/site"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"

import { Icons } from "../icons"
import { NavMain } from "./nav-main"
import { NavProjects } from "./nav-project"
import { NavUser } from "./nav-user"

// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  projects: [
    {
      name: "การตั้งค่า",
      url: "#",
      icon: Frame,
    },
    {
      name: "สมาชิก",
      url: "#",
      icon: PieChart,
    },
    {
      name: "การชำระเงิน",
      url: "#",
      icon: Map,
    },
  ],
}

// const classes = [
//   {
//     title: "ห้องเรียนฟิสิกส์",
//     url: "#",
//     icon: BookOpen,
//     isActive: true,
//     items: [
//       {
//         title: "ข้อมูลทั่วไป",
//         url: "#",
//       },
//       {
//         title: "เนื้อหา",
//         url: "#",
//       },
//     ],
//   },
// ];
interface AppSidebarProps {
  children?: React.ReactNode
  navMain: {
    title: string
    url: string
    icon?: string
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}

export function AppSidebar({ ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Icons.logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {siteConfig.name}
                </span>
                <span className="truncate text-xs text-green-400">อาจารย์</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent>
        <NavMain items={props.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarSeparator className="mx-0" />
      <SidebarFooter>
        <div className="p-1">
          <NavUser user={data.user} />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
