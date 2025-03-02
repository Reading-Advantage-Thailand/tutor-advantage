/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { siteConfig } from "@/configs/site"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/loading-button"

import { authSignIn } from "../services/auth-service"
import { FormData, UserAuthFormProps } from "../types"
import { userAuthSchema } from "../user-auth-schema"

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(userAuthSchema),
  })
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [isGoogleLoading, setIsGoogleLoading] = React.useState<boolean>(false)
  const searchParams = useSearchParams()

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    await authSignIn(data, searchParams)
      .then((_) => {
        toast.success("เราได้ส่งลิงก์เข้าสู่ระบบไปยังอีเมลของคุณแล้ว", {
          description: "กรุณาตรวจสอบอีเมลของคุณเพื่อเข้าสู่ระบบ",
        })
      })
      .catch((_) => {
        toast.error("เกิดข้อผิดพลาด", {
          description: "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง",
        })
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true)
    await signIn("google", { callbackUrl: "/tutor" })
      .catch((error) => {
        console.error("error signing in with Google:", error)
      })
      .finally(() => {
        setIsGoogleLoading(false)
      })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden shadow-lg">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">ยินดีต้อนรับ</h1>
                <p className="text-balance text-muted-foreground">
                  เข้าสู่ระบบด้วยบัญชี {siteConfig.name}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">อีเมล</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  disabled
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">รหัสผ่าน</Label>
                  <a
                    href="#"
                    className="ml-auto text-sm underline-offset-2 hover:underline"
                  >
                    ลืมรหัสผ่าน?
                  </a>
                </div>
                <Input id="password" type="password" required disabled />
              </div>
              <Button type="submit" className="w-full" disabled>
                เข้าสู่ระบบ
              </Button>
              <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 px-2 text-muted-foreground">
                  หรือ
                </span>
              </div>
              <LoadingButton
                isLoading={isGoogleLoading}
                icon="google"
                onClick={handleGoogleSignIn}
              >
                Sign in with Google
              </LoadingButton>
              <div className="text-center text-sm">
                ยังไม่มีบัญชี?{" "}
                <a href="#" className="underline underline-offset-4">
                  ลงทะเบียน
                </a>
              </div>
            </div>
          </form>
          <div className="relative hidden bg-muted md:block">
            <img
              src="https://app.reading-advantage.com/_next/image?url=https%3A%2F%2Fstorage.googleapis.com%2Fartifacts.reading-advantage.appspot.com%2Fimages%2FFE4u3v5SwuSK2LsymEWQ.png&w=1920&q=75"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        หากคุณเข้าสู่ระบบ แสดงว่าคุณยอมรับ <a href="#">ข้อตกลงการใช้งาน</a> และ{" "}
        <a href="#">นโยบายความเป็นส่วนตัว</a>.
      </div>
    </div>
  )
}
