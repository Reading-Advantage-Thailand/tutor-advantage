import { ButtonHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

import { Icons } from "./icons"

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  icon?: keyof typeof Icons
}

export function LoadingButton({
  isLoading,
  icon,
  children,
  className,
  ...props
}: LoadingButtonProps) {
  const IconComponent = icon ? Icons[icon] : null

  return (
    <button
      className={cn(
        "flex items-center justify-center px-4 py-2 text-white bg-blue-600 rounded-md disabled:opacity-50",
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <Icons.spinner className="mr-2 size-4 animate-spin" />
      ) : (
        IconComponent && <IconComponent className="mr-2 size-4" />
      )}
      {children}
    </button>
  )
}
