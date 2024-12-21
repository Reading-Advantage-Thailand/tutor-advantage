/* eslint-disable @typescript-eslint/no-empty-object-type */
"use client"

import React from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Icons } from "../icons"
import { ButtonProps, buttonVariants } from "../ui/button"

interface ClassCreateButtonProps extends ButtonProps {}

export default function ClassCreateButton({
  className,
  variant,
  ...props
}: ClassCreateButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  async function onClick() {
    setIsLoading(true)

    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Untitled Post",
      }),
    })

    setIsLoading(false)

    if (!response?.ok) {
      if (response.status === 402) {
        return toast({
          title: "Limit of 3 posts reached.",
          description: "Please upgrade to the PRO plan.",
          variant: "destructive",
        })
      }

      return toast({
        title: "Something went wrong.",
        description: "Your post was not created. Please try again.",
        variant: "destructive",
      })
    }

    const post = await response.json()

    // This forces a cache invalidation.
    router.refresh()

    router.push(`/editor/${post.id}`)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className={cn(
            buttonVariants({ variant }),
            {
              "cursor-not-allowed opacity-60": isLoading,
            },
            className
          )}
          {...props}
        >
          สร้างห้องเรียนใหม่
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>สร้างห้องเรียนใหม่</DialogTitle>
          <DialogDescription>
            สร้างห้องเรียนใหม่เพื่อเริ่มต้นการสร้างเนื้อหา หรือเรียนรู้
            กับผู้เรียน ในห้องเรียนของคุณ
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              ชื่อห้องเรียน
            </Label>
            <Input id="name" value="Pedro Duarte" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="desc" className="text-right">
              คำอธิบายเพิ่มเติม
            </Label>
            <Input id="desc" value="@peduarte" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={onClick} disabled={isLoading}>
            {isLoading && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            สร้างห้องเรียน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
