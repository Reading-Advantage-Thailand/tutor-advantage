"use client"

import { Class, Role, User } from "@prisma/client"
import * as LucideIcons from "lucide-react"
import { Users, Wrench, type LucideIcon } from "lucide-react"

import { AppSidebarData } from "@/components/app-sidebar"

export function mapToSidebar(user: User, classes: Class[], role: Role): AppSidebarData {
  return {
    user: {
      name: user.name || "ผู้ใช้",
      email: user.email || "ไม่มีอีเมล",
      avatar: user.image ?? "",
    },
    navMain: classes.map((cls) => {
      const baseUrl = `/${role.toLowerCase()}/classes/${cls.id}`
      const items = [
        {
          title: "สมาชิก",
          url: `${baseUrl}/members`,
        },
      ]

      if (role === Role.TUTOR) {
        items.push({
          title: "การตั้งค่าห้องเรียน",
          url: `${baseUrl}/settings`,
        })
      }

      return {
        title: cls.name,
        url: baseUrl,
        icon: getLucideIcon(cls.icon),
        isActive: true,
        items,
      }
    }),
    projects: [
      {
        name: "การตั้งค่าส่วนตัว",
        url: "#",
        icon: Wrench,
      },
      ...(role === Role.TUTOR
        ? [
          {
            name: "การเชิญชวนครู",
            url: "#",
            icon: Users,
          },
        ]
        : []),
    ],
  }
}

function getLucideIcon(name: string): LucideIcon {
  const icon = LucideIcons[name as keyof typeof LucideIcons]
  if (typeof icon === "function") {
    return icon as LucideIcon
  }
  return LucideIcons.LayoutDashboard
}
