import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/tutor/app-sidebar"
import { NavActions } from "@/components/tutor/nav-actions"
import NavPath from "@/components/tutor/nav-path"

interface TutorLayoutProps {
  children?: React.ReactNode
}

function getTutorClasses() {
  const classes = [
    {
      title: "ห้องเรียนฟิสิกส์",
      url: "#",
      icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1hdG9tIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxIi8+PHBhdGggZD0iTTIwLjIgMjAuMmMyLjA0LTIuMDMuMDItNy4zNi00LjUtMTEuOS00LjU0LTQuNTItOS44Ny02LjU0LTExLjktNC41LTIuMDQgMi4wMy0uMDIgNy4zNiA0LjUgMTEuOSA0LjU0IDQuNTIgOS44NyA2LjU0IDExLjkgNC41WiIvPjxwYXRoIGQ9Ik0xNS43IDE1LjdjNC41Mi00LjU0IDYuNTQtOS44NyA0LjUtMTEuOS0yLjAzLTIuMDQtNy4zNi0uMDItMTEuOSA0LjUtNC41MiA0LjU0LTYuNTQgOS44Ny00LjUgMTEuOSAyLjAzIDIuMDQgNy4zNi4wMiAxMS45LTQuNVoiLz48L3N2Zz4=",
      isActive: true,
      items: [
        {
          title: "ข้อมูลทั่วไป",
          url: "#",
        },
        {
          title: "เนื้อหา",
          url: "#",
        },
      ],
    },
  ]
  return classes
}
export default async function TutorLayout({ children }: TutorLayoutProps) {
  const tutorClasses = getTutorClasses()
  return (
    <SidebarProvider>
      <AppSidebar navMain={tutorClasses} />
      <SidebarInset>
        <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <NavPath />
          </div>
          <div className="ml-auto px-3">
            <NavActions />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
