/* eslint-disable @next/next/no-img-element */
"use client"

import * as React from "react"
import { Clipboard, ClipboardCheck, ExpandIcon } from "lucide-react"

import { toast } from "@/hooks/use-toast"
import { Button, ButtonProps } from "@/components/ui/button"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog"

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
    <div className="flex gap-2">
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
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="secondary">
            <ExpandIcon className="size-5" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>คัดลอกลิงค์เชิญห้องเรียน</DialogTitle>
            <DialogDescription>
              คัดลอกลิงค์เชิญเพื่อส่งให้นักเรียนเข้าร่วมห้องเรียน
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center items-center gap-4 flex-col">
            <img
              className="size-[20rem] bg-white rounded-md shadow-md"
              src="https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg"
              alt="qr-code"
            />
            <p className="text-center text-5xl">ID: {code}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
