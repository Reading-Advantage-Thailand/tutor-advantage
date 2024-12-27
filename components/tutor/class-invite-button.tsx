"use client"

import * as React from "react"
import { Clipboard, ClipboardCheck } from "lucide-react"

import { toast } from "@/hooks/use-toast"
import { Button, ButtonProps } from "@/components/ui/button"

type ClassInviteButtonProps = ButtonProps & {
  code: string
}

export function ClassInviteButton({
  code,
  className,
  variant,
  size,
  ...props
}: ClassInviteButtonProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  async function onClick() {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    await navigator.clipboard.writeText(code)
    toast({
      title: "คัดลอกลิงค์เชิญสำเร็จ",
      description: "คัดลอกลิงค์เชิญสำเร็จแล้ว",
    })
    setIsLoading(false)
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
        <ClipboardCheck className="size-4 text-green-400" />
      ) : (
        <Clipboard className="size-4" />
      )}
      คัดลอกลิงค์เชิญ
    </Button>
  )
}
