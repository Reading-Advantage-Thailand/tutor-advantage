"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { IconCircleCheckFilled, IconLoader } from "@tabler/icons-react"
import { User } from "@prisma/client"

export type Member = Pick<User, "id" | "email" | "name"> & {
  status?: ClassMemberStatus | null
}

export enum ClassMemberStatus {
  JOINED,
  PENDING
}

export const columns: ColumnDef<Member>[] = [
  {
    accessorKey: "name",
    header: "ชื่อ",
  },
  {
    accessorKey: "email",
    header: "อีเมล",
  },
  {
    accessorKey: "status",
    header: "สถานะ",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-muted-foreground px-1.5">
        {row.original.status === ClassMemberStatus.JOINED ? (
          <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
        ) : (
          <IconLoader />
        )}
        {row.original.status === ClassMemberStatus.JOINED
          ? "เข้าร่วมแล้ว"
          : "รอยืนยัน"}
      </Badge>
    ),
  },
]