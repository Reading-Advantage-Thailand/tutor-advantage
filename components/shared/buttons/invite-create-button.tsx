"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { ButtonProps, buttonVariants } from "@/components/ui/button"

import { Icons } from "../icons"

interface InviteCreateButtonProps extends ButtonProps {}

export function InviteCreateButton({
  className,
  variant,
  ...props
}: InviteCreateButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  async function onClick() {
    setIsLoading(true)

    const response = await fetch("/api/v1/tutor/invites", {
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
    <button
      onClick={onClick}
      className={cn(
        buttonVariants({ variant }),
        {
          "cursor-not-allowed opacity-60": isLoading,
        },
        className
      )}
      disabled={isLoading}
      {...props}
    >
      {isLoading ? (
        <Icons.spinner className="mr-2 size-4 animate-spin" />
      ) : (
        <Icons.add className="mr-2 size-4" />
      )}
      สร้างรหัสคำเชิญใหม่
    </button>
  )
}
