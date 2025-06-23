import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import React from 'react'
import { Invite, columns } from './columns'
import { DataTable } from './data'

async function getData(): Promise<Invite[]> {
  return [
    {
      id: "728ed52f",
      name: "ภาสกร พุทธมา",
      email: "boss4848@gmail.com",
      status: "joined",
    },
    {
      id: "b2f1c3a4",
      name: "ณัฐวุฒิ สายทอง",
      email: "nut@gmail.com",
      status: "joined",
    },
    {
      id: "c3d2e1f4",
      name: "สุพรรณี แสนสุข",
      email: "sunee@gmail.com",
      status: "pending",
    },
    {
      id: "d4e5f6a7",
      name: "สมชาย ใจดี",
      email: "jai@gmail.com",
      status: "joined",
    },
  ]
}

export default async function TutorInvitationPage() {
  const data = await getData()

  return (
    <div className='m-4'>
      <Card className='mb-6'>
        <CardContent>
          <form className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="invite-code">รหัสคำเชิญครู</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-code"
                  type="text"
                  placeholder="asdsd-1234-5678"
                  disabled
                  className="flex-1"
                />
                <Button variant="outline" className="shrink-0" disabled>
                  <Plus className="size-4" />
                  สร้างรหัสใหม่
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <DataTable columns={columns} data={data} />
    </div>

  )
}