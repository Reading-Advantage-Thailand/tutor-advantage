"use client"

import * as React from "react"
import { InvitationStatus } from "@prisma/client"
import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"

import { formatThaiDate } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type Invite = {
  id: string
  code: string
  status: InvitationStatus
  email: string
  createdAt: string
}

export const columns: ColumnDef<Invite>[] = [
  {
    accessorKey: "code",
    header: "รหัสคำเชิญ",
    cell: ({ row }) => <div>{row.getValue("code")}</div>,
  },
  {
    accessorKey: "status",
    header: "สถานะ",
    cell: ({ row }) => <div>{mapStatus(row.getValue("status"))}</div>,
  },
  {
    accessorKey: "email",
    header: "อีเมล",
    cell: ({ row }) => (
      <div className="lowercase">{row.getValue("email") ?? "-"}</div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: () => <div className="text-right">สร้างเมื่อ</div>,
    cell: ({ row }) => (
      <div className="text-right">
        {formatThaiDate(row.getValue("createdAt"))}
      </div>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const invite = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-8 p-0">
              <span className="sr-only">จัดการ</span>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(invite.code)
                toast({
                  title: "คัดลอกรหัสคำเชิญ",
                  description: `คัดลอกรหัสคำเชิญ "${invite.code}" แล้ว`,
                })
              }}
            >
              คัดลอกรหัสคำเชิญ
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async (event) => {
                event.preventDefault()
                const response = await fetch(
                  `/api/v1/tutor/invites/${invite.id}`,
                  { method: "DELETE" }
                )
                const data = await response.json()
                if (!response.ok) {
                  toast({
                    title: "เกิดข้อผิดพลาด",
                    description: `${data.message}`,
                    variant: "destructive",
                  })
                  return
                }
                toast({
                  title: "ลบคำเชิญ",
                  description:
                    "ลบคำเชิญนี้แล้ว กรุณารีเฟรชหน้าเพื่อดูการเปลี่ยนแปลง",
                })
              }}
            >
              ลบ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

function mapStatus(status: InvitationStatus): string {
  switch (status) {
    case "PENDING":
      return "รอการตอบรับ"
    case "ACCEPTED":
      return "ตอบรับแล้ว"
    case "REJECTED":
      return "ปฏิเสธแล้ว"
  }
}
