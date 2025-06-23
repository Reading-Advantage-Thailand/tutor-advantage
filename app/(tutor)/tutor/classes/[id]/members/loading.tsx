import { Label } from "@/components/ui/label"
import { DataTableLoading } from "./data-table-loading"

export default function Loading() {
  return (
    <div className="m-4 flex flex-col gap-4">
      <Label>คุณครู</Label>
      <DataTableLoading columns={3} rows={1} />
      <Label>รายชื่อสมาชิกในชั้นเรียน</Label>
      <DataTableLoading columns={3} rows={3} />
    </div>
  )
}