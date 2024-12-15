"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { SidebarNavItem } from "@/types"
import { Icons } from "./icons"

interface NavProps {
  items: SidebarNavItem[]
}
type IconKeys = keyof typeof Icons

export function Nav({ items }: NavProps) {
  const path = usePathname()

  if (!items?.length) {
    return null
  }

  return (
    <nav className="grid items-start gap-2">
      {items.map((item, index) => {
        const iconKey = (item.icon || "arrowRight") as IconKeys
        const Icon = Icons[iconKey]
        return (
          item.href && (
            <Link
              key={index}
              href={item.disabled ? "/" : item.href}
              className={cn(
                "text-muted-foreground flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                path === item.href ? "bg-accent" : "transparent",
                item.disabled && "cursor-not-allowed opacity-80"
              )}
            >
              <Icon className="size-4" />
              {item.title}
            </Link>
          )
        )
      })}
    </nav>
  )
}
