"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { IconCircleCheckFilled, IconLoader } from "@tabler/icons-react"
export type Invite = {
  id: string
  name: string
  email: string
  status: "joined" | "pending"
}

export const columns: ColumnDef<Invite>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-muted-foreground px-1.5">
        {row.original.id}
      </Badge>
    ),
    enableSorting: false,
    enableHiding: false,
    enableColumnFilter: false,
    enableResizing: false,
  },
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
        {row.original.status === "joined" ? (
          <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
        ) : (
          <IconLoader />
        )}
        {row.original.status === "joined"
          ? "เข้าร่วมแล้ว"
          : "รอยืนยัน"}
      </Badge>
    ),
  },
]