import * as React from "react"
import { ClassMemberRole } from "@prisma/client"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

import { UserAvatar } from "../user-avatar"

export interface ClassMember {
  tutors: {
    userId: string
    role: ClassMemberRole
    user: {
      name: string
      image: string
    }
  }[]
  students: {
    userId: string
    role: ClassMemberRole
    user: {
      name: string
      image: string
    }
  }[]
}

interface SidebarClassProps extends React.ComponentProps<typeof Sidebar> {
  classMembers: ClassMember
}

export function SidebarClass({ classMembers, ...props }: SidebarClassProps) {
  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 hidden h-svh border-l lg:flex"
      {...props}
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            คุณครู - ({classMembers.tutors.length})
          </SidebarGroupLabel>
          <SidebarMenu>
            {classMembers.tutors.map((tutor, index) => (
              <SidebarProfile
                key={tutor.userId + index}
                name={tutor.user.name}
                Image={tutor.user.image}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator className="mx-0" />
        <SidebarGroup>
          <SidebarGroupLabel>
            นักเรียน - ({classMembers.students.length})
          </SidebarGroupLabel>
          <SidebarMenu>
            {classMembers.students.map((student) => (
              <SidebarProfile
                key={student.userId}
                name={student.user.name}
                Image={student.user.image}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarSeparator className="mx-0" />
      </SidebarContent>
    </Sidebar>
  )
}

function SidebarProfile({ name, Image }: { name: string; Image: string }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton className="h-[3rem]">
        <UserAvatar
          user={{
            name: name,
            image: Image,
          }}
        />
        <span>{name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
