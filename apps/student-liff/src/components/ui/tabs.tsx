"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type TabsContextValue = {
  value: string
  setValue: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? value ?? "")
  const selectedValue = value ?? internalValue
  const setValue = React.useCallback(
    (nextValue: string) => {
      setInternalValue(nextValue)
      onValueChange?.(nextValue)
    },
    [onValueChange]
  )

  return (
    <TabsContext.Provider value={{ value: selectedValue, setValue }}>
      <div data-slot="tabs" className={cn("space-y-2", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="tabs-list"
      className={cn("inline-flex items-center gap-1 rounded-lg bg-muted p-1", className)}
      {...props}
    />
  )
}

function TabsTrigger({
  value,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { value: string }) {
  const context = React.useContext(TabsContext)
  const selected = context?.value === value
  return (
    <button
      type="button"
      data-slot="tabs-trigger"
      data-state={selected ? "active" : "inactive"}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className
      )}
      onClick={() => context?.setValue(value)}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({
  value,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { value: string }) {
  const context = React.useContext(TabsContext)
  if (context?.value !== value) return null
  return (
    <div data-slot="tabs-content" className={cn("outline-none", className)} {...props}>
      {children}
    </div>
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
