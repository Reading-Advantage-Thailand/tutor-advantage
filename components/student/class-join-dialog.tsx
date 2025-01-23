"use client"

import React, { useEffect } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "../ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog"
import { Form, FormControl, FormField, FormItem, FormMessage } from "../ui/form"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../ui/input-otp"

const FormSchema = z.object({
  code: z.string().min(7, {
    message: "รหัสต้องมี 6 ตัวอักษร",
  }),
})

type ClassJoinDialogProps = {
  open: boolean
}

export default function ClassJoinDialog({ open }: ClassJoinDialogProps) {
  const router = useRouter()

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      code: "",
    },
  })

  useEffect(() => {
    const codeLength = form.watch("code")?.length

    if (codeLength === 7) {
      router.push(`/code/c?id=${form.watch("code")}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch("code")])

  return (
    <Dialog open={open}>
      <DialogTrigger asChild>
        <Button variant="outline">เข้าร่วมห้องเรียนอื่นๆ</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ดูเหมือนว่าคุณไม่มีคลาสเรียนใดๆเลย</DialogTitle>
          <DialogDescription>
            คุณสามารถเข้าร่วมคลาสเรียนโดยใช้รหัสเชิญ 6 หลัก ที่ได้รับจากครู
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="w-full flex justify-center">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <InputOTP maxLength={7} {...field}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                        <InputOTPSlot index={6} />
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
