"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { toast } from "@/hooks/use-toast"
import { Button, ButtonProps } from "@/components/ui/button"

import { Icons } from "./icons"

type InviteCreateButtonProps = ButtonProps

export function InviteCreateButton({
  className,
  variant,
  size,
  ...props
}: InviteCreateButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  async function onClick() {
    setIsLoading(true)

    const response = await fetch("/api/v1/invites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    setIsLoading(false)

    if (!response?.ok) {
      return toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถสร้างรหัสคำเชิญใหม่ได้",
        variant: "destructive",
      })
    }

    router.refresh()
  }

  return (
    <Button
      onClick={onClick}
      className={className}
      disabled={isLoading}
      size={size}
      variant={variant}
      {...props}
    >
      {isLoading ? (
        <Icons.spinner className="size-4 animate-spin" />
      ) : (
        <Icons.add className="size-4" />
      )}
      สร้างรหัสคำเชิญใหม่
    </Button>
  )
}
