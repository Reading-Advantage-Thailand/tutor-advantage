"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Trash } from "lucide-react"

import { toast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = [
  [
    {
      label: "ออกจากห้องเรียน",
      icon: Trash,
    },
  ],
]

type NavActionsProps = {
  classId: string
}

export function NavActions({ classId }: NavActionsProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    setIsOpen(false)
  }, [])

  async function handleLeaveClass() {
    console.log("classId", classId)
    const data = await fetch("/api/v1/classes/leave", {
      method: "POST",
      body: JSON.stringify({
        classId: classId,
      }),
    })
    if (!data.ok) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถออกจากห้องเรียนได้",
        variant: "destructive",
      })
    } else {
      toast({
        title: "ออกจากห้องเรียนสำเร็จ",
        description: "คุณได้ออกจากห้องเรียนแล้ว",
      })
      router.refresh()
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="data-[state=open]:bg-accent size-7"
          >
            <MoreHorizontal />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-56 overflow-hidden rounded-lg p-0"
          align="end"
        >
          <Sidebar collapsible="none" className="bg-transparent">
            <SidebarContent>
              {data.map((group, index) => (
                <SidebarGroup key={index} className="border-b last:border-none">
                  <SidebarGroupContent className="gap-0">
                    <SidebarMenu>
                      {group.map((item, index) => (
                        <SidebarMenuItem key={index}>
                          <SidebarMenuButton
                            onClick={
                              item.label === "ออกจากห้องเรียน"
                                ? handleLeaveClass
                                : () => setIsOpen(false)
                            }
                          >
                            <item.icon /> <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))}
            </SidebarContent>
          </Sidebar>
        </PopoverContent>
      </Popover>
    </div>
  )
}
