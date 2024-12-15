import { TutorConfig } from "@/types";

export const tutorConfig: TutorConfig = {
  mainNav: [
    {
      title: "ซัพพอร์ต",
      href: "/support",
      disabled: true,
    },
  ],
  sidebarNav: [
    {
      title: "ห้องเรียน",
      href: "/tutor/classes",
      icon: "classes",
    },
    {
      title: "คำเชิญ",
      href: "/tutor/invites",
      icon: "invites",
    },
  ],
}