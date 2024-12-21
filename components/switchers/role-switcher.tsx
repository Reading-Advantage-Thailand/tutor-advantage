"use client"

import React from "react"
import Link from "next/link"
import { Role } from "@prisma/client"
import { GraduationCap, UserCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

import { Icons } from "../icons"

interface RoleSwitcherProps {
  userId?: string
  role?: Role
}

const roles = [
  {
    title: "นักเรียน",
    description: "บทบาทนักเรียนเหมาะสำหรับผู้ใช้ที่เข้าร่วมคอร์สเรียน",
    icon: <UserCircle size={32} />,
    value: Role.STUDENT,
    color: "blue",
  },
  {
    title: "ผู้สอน",
    description: "บทบาทผู้สอนเหมาะสำหรับผู้ใช้ที่สร้างคอร์สเรียน",
    icon: <GraduationCap size={32} />,
    value: Role.TUTOR,
    color: "blue",
  },
]

export default function RoleSwitcher({ userId, role }: RoleSwitcherProps) {
  const [selectedRole, setSelectedRole] = React.useState<Role>(
    role ?? Role.GUEST
  )
  const [isLoading, setIsLoading] = React.useState(false)

  async function onUpdateRole(role: Role) {
    setIsLoading(true)

    const response = await fetch(`/api/v1/users/${userId}/role`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role,
      }),
    })

    setIsLoading(false)

    if (!response.ok) {
      return toast({
        title: "เกิดข้อผิดพลาด",
        description: `ไม่สามารถอัปเดตบทบาทของคุณได้ กรุณาลองใหม่อีกครั้ง`,
        variant: "destructive",
      })
    }

    setSelectedRole(role)

    return toast({
      title: "อัปเดตบทบาทสำเร็จ",
      description: "บทบาทของคุณได้รับการอัปเดตเป็น " + role,
    })
  }
  return (
    <>
      <div className="flex flex-col justify-center text-start sm:flex-row sm:space-x-4">
        {roles.map((role, index) => (
          <RoleSelectionItem
            disabled={isLoading}
            onClick={() => onUpdateRole(role.value)}
            key={index}
            {...role}
            isSelected={selectedRole === role.value}
            color={role.color}
          />
        ))}
      </div>
      {selectedRole !== Role.GUEST && (
        <Link
          className={cn(buttonVariants({ variant: "ghost" }), "mt-5")}
          href={selectedRole === Role.STUDENT ? "/student" : "/invite"}
        >
          ถัดไป
          <Icons.chevronRight className="ml-2 size-4" />
        </Link>
      )}
    </>
  )
}

const RoleSelectionItem = ({
  title,
  description,
  icon,
  isSelected,
  onClick,
  disabled = false,
}: {
  title: string
  description: string
  icon: React.ReactNode
  isSelected: boolean
  onClick: () => void
  color: string
  disabled: boolean
}) => (
  <Card
    className={cn(
      "hover:bg-secondary mt-10 w-[300px] cursor-pointer transition-shadow duration-200 hover:scale-105 hover:shadow-lg",
      disabled ? "opacity-50" : "",
      isSelected ? "shadow-lg dark:bg-blue-900" : "bg-card"
    )}
    onClick={disabled ? undefined : onClick}
  >
    <CardHeader>{icon}</CardHeader>
    <CardContent>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-muted-foreground text-[0.8rem]">{description}</p>
    </CardContent>
  </Card>
)
