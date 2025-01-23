"use client"

import React from "react"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default function NavPath() {
  const path = usePathname()
  // skip the /tutor path
  // path = path.replace(/^\/tutor/, "")
  const segments = path.split("/").filter(Boolean)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1
          const isChannelOrClass = index === 1 || index === 3 || index === 5
          const isId = index === 2 || index === 4 || index === 6
          const href = `/${segments.slice(0, index + 1).join("/")}`

          return (
            <React.Fragment key={segment}>
              <BreadcrumbItem>
                {isLast || isChannelOrClass ? (
                  <BreadcrumbPage
                    className={cn(
                      "capitalize",
                      isChannelOrClass && "text-muted-foreground",
                      isId && "truncate w-10"
                    )}
                  >
                    {segment}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={href}
                    className={cn("capitalize", isId && "truncate w-10")}
                  >
                    {segment}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
