import { TutorConfig } from "@/types";

export const tutorConfig: TutorConfig = {
  navSidebarMain: {
    title: "ห้องเรียน",
    items: []
  },
  navSidebarSecondary: {
    title: "อื่น ๆ",
    items: [
      {
        title: "การเชิญชวน",
        href: "/tutor/invites",
        icon: "invite",
      },
      {
        title: "ตั้งค่า",
        href: "/tutor/settings",
        icon: "settings",
      }
    ],
  }
}
