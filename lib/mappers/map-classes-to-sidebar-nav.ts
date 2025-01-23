import { AppSidebarProps } from "@/components/sidebar/app-sidebar";
import { Role } from "@prisma/client";

export const mapClassesToSidebarNav = (
  user: { role: Role; },
  classes: {
    id: string;
    name: string;
    channels: { id: string; name: string }[];
  }[]
): AppSidebarProps["navmain"] => {
  return {
    title: "ห้องเรียน",
    items: classes.map((cls) => ({
      title: cls.name,
      url: `/${user.role.toLocaleLowerCase()}/classes/${cls.id}`,
      items: cls.channels.map((channel) => ({
        title: channel.name,
        url: `/${user.role.toLocaleLowerCase()}/classes/${cls.id}/channels/${channel.id}`,
      })),
    })),
  };
};