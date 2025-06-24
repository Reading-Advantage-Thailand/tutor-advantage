"use client"

import React from "react"
import { usePathname } from "next/navigation"
import { Role } from "@prisma/client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb"

interface AppSidebarPathProps {
  className: string
  role: Role
}
export default function AppSidebarPath({
  className,
  role,
}: AppSidebarPathProps) {
  const pathname = usePathname()
  const last = pathname.split("/").pop()
  let path
  switch (last) {
    case "members":
      path = "สมาชิก"
      break
    case "settings":
      path = "การตั้งค่าห้องเรียน"
      break
    default:
      path = ""
      break
  }
  if (!path) return null
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href={`/${role.toLocaleLowerCase()}/classes`}>
            {className}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem>
          <BreadcrumbPage>{path}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
