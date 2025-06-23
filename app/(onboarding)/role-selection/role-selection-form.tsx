"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GraduationCap, Users } from "lucide-react"

import { handleClientError } from "@/lib/error-mapper"

const roles = [
  {
    key: "student",
    icon: <GraduationCap className="size-8" />,
    title: "ฉันเป็นนักเรียน",
    description: "เข้าร่วมชั้นเรียนและเรียนรู้จากครูผู้สอน",
    redirect: "/student-invitation",
  },
  {
    key: "tutor",
    icon: <Users className="size-8" />,
    title: "ฉันเป็นครู",
    description: "สร้างชั้นเรียนและสอนนักเรียนของคุณ",
    redirect: "/tutor-invitation",
  },
] as const

export default function RoleSelectionForm() {
  const router = useRouter()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const handleRoleSelection = async (role: "tutor" | "student", redirect: string) => {
    if (!session?.user?.id) {
      toast.error("คุณต้องเข้าสู่ระบบก่อน")
      return router.push("/login")
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/v1/users/${session.user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message)
      }

      toast.success("สร้างบทบาทสำเร็จ")
      router.push(redirect)
    } catch (error) {
      const message = handleClientError(error)
      toast.error(message)

      if (error instanceof Error) {
        if (error.message === "คุณมีบทบาทอยู่แล้ว") {
          return router.push(redirect)
        }
        if (error.message === "คุณไม่มีสิทธิ์เข้าถึงหน้านี้") {
          return router.push("/login")
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">เลือกบทบาทของคุณ</CardTitle>
        <CardDescription>เลือกบทบาทของคุณเพื่อเริ่มต้นใช้งาน</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          <div className="flex flex-col gap-4">
            {roles.map((role) => (
              <Button
                key={role.key}
                variant="outline"
                className="w-full h-auto flex flex-col items-start text-start p-4 gap-2"
                onClick={() => handleRoleSelection(role.key, role.redirect)}
                disabled={isLoading}
              >
                <div className="p-2 rounded bg-muted">{role.icon}</div>
                <h3 className="text-lg font-semibold">{role.title}</h3>
                <p className="text-sm text-muted-foreground">{role.description}</p>
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
