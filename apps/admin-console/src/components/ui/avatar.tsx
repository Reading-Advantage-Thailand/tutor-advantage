"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Avatar (legacy shadcn API, no radix): <AvatarImage> shows once loaded,
 * <AvatarFallback> shows until then or when the image fails.
 * New code: <UserAvatar name src /> from "@/components/app".
 */
type Status = "idle" | "loading" | "loaded" | "error"
const AvatarContext = React.createContext<{ status: Status; setStatus: (s: Status) => void }>({
  status: "idle",
  setStatus: () => {},
})

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"span"> & { size?: "default" | "sm" | "lg" }) {
  const [status, setStatus] = React.useState<Status>("idle")
  const value = React.useMemo(() => ({ status, setStatus }), [status])
  return (
    <AvatarContext.Provider value={value}>
      <span
        data-slot="avatar"
        data-size={size}
        className={cn(
          "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
          className
        )}
        {...props}
      />
    </AvatarContext.Provider>
  )
}

function AvatarImage({ className, src, alt = "", onLoad, onError, ...props }: React.ComponentProps<"img">) {
  const { status, setStatus } = React.useContext(AvatarContext)
  React.useEffect(() => {
    setStatus(src ? "loading" : "error")
  }, [src, setStatus])
  if (!src || status === "error") return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      data-slot="avatar-image"
      src={typeof src === "string" ? src : undefined}
      alt={alt}
      referrerPolicy="no-referrer"
      className={cn("aspect-square size-full object-cover", status !== "loaded" && "absolute opacity-0", className)}
      onLoad={(event) => {
        setStatus("loaded")
        onLoad?.(event)
      }}
      onError={(event) => {
        setStatus("error")
        onError?.(event)
      }}
      {...props}
    />
  )
}

function AvatarFallback({ className, ...props }: React.ComponentProps<"span">) {
  const { status } = React.useContext(AvatarContext)
  if (status === "loaded") return null
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-tile-brand text-sm font-semibold text-icon-brand group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex size-2.5 items-center justify-center rounded-full bg-brand-solid text-on-brand ring-2 ring-surface select-none",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn("group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-surface", className)}
      {...props}
    />
  )
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-bg text-sm text-neutral-fg ring-2 ring-surface", className)}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback, AvatarBadge, AvatarGroup, AvatarGroupCount }
