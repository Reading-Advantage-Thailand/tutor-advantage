"use client"

import * as React from "react"
import Link from "next/link"
import { SidebarNavItem } from "@/types"
import { Role, User } from "@prisma/client"

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
import { NavSecondary } from "./nav-secondary"
import { NavUser } from "./nav-user"

export interface AppSidebarProps {
  user?: Pick<User, "name" | "email" | "image" | "role">
  navmain: {
    title: string
    items?: {
      title: string
      url: string
      icon?: string
      items?: {
        title: string
        url: string
      }[]
    }[]
  }
  navsecondary?: {
    title: string
    items: SidebarNavItem[]
  }
  children?: React.ReactNode
}

export function AppSidebar({ ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link
              href={props?.user?.role === Role.TUTOR ? "/tutor" : "/student"}
            >
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
                  <span className="truncate text-xs text-green-400">
                    {props?.user?.role === Role.TUTOR ? "ผู้สอน" : "ผู้เรียน"}
                  </span>
                </div>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent>
        <NavMain items={props.navmain.items} title={props.navmain.title} />
        {props.navsecondary && (
          <NavSecondary items={props.navsecondary.items} />
        )}
      </SidebarContent>
      <SidebarSeparator className="mx-0" />
      {props.user && (
        <SidebarFooter>
          <div className="p-1">
            <NavUser user={props.user} />
          </div>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
