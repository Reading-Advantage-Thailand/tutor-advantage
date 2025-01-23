"use client"

import { SidebarNavItem } from "@/types"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { Icons } from "../icons"

interface NavSecondaryProps {
  items: SidebarNavItem[]
}

export function NavSecondary({ items }: NavSecondaryProps) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>อื่น ๆ</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const Icon = Icons[item.icon || "arrowRight"]
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild disabled={item.disabled}>
                <a href={item.href} target={item.external ? "_blank" : "_self"}>
                  <Icon className="size-4" />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
