/* eslint-disable @typescript-eslint/no-empty-object-type */
"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { classCreateSchema } from "@/lib/validations/class"
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
import { ButtonProps } from "../ui/button"

interface ClassCreateButtonProps extends ButtonProps {}

type FormData = z.infer<typeof classCreateSchema>

export default function ClassCreateButton({
  className,
  variant,
  size,
  ...props
}: ClassCreateButtonProps) {
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(classCreateSchema),
  })
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  async function onSubmit(data: FormData) {
    setIsLoading(true)
    const response = await fetch(`/api/v1/classes`, {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        description: data.description,
      }),
    })

    setIsLoading(false)

    if (!response?.ok) {
      return toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถสร้างห้องเรียนใหม่ได้",
        variant: "destructive",
      })
    }

    toast({
      description: "สร้างห้องเรียนใหม่สำเร็จ",
    })

    const { slug } = await response.json()
    router.push(`/tutor/class/${slug}`)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className={className} size={size} variant={variant} {...props}>
          <Icons.add className="size-4" />
          สร้างห้องเรียนใหม่
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
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
              <Input
                id="name"
                required
                className="col-span-3"
                {...register("name")}
              />
              {errors?.name && (
                <p className="col-span-3 col-start-2 px-1 text-xs text-red-600">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="desc" className="text-right">
                คำอธิบายเพิ่มเติม
              </Label>
              <Input
                id="description"
                required
                className="col-span-3"
                {...register("description")}
              />
              {errors?.description && (
                <p className="col-span-3 col-start-2 px-1 text-xs text-red-600">
                  {errors.description.message}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Icons.spinner className="size-4 animate-spin" />}
              สร้างห้องเรียน
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
