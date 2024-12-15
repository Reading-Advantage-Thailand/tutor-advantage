import * as React from "react"

import { cn } from "@/lib/utils"
import { siteConfig } from "@/config/site-config"
import { Icons } from "./icons"
import { ThemeSwitcher } from "./switcher/theme-switcher"

export function SiteFooter({ className }: React.HTMLAttributes<HTMLElement>) {
  return (
    <footer className={cn(className)}>
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <Icons.logo />
          <p className="text-center text-sm leading-loose md:text-left">
            @ {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
        </div>
        <ThemeSwitcher />
      </div>
    </footer>
  )
}