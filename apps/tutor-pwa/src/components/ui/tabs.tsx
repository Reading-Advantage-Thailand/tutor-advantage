"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Tabs (components.md §8, tutor). App code picks a variant:
 * - `segmented`: track --surface-muted + 1px --clay-rim, padding 3, radius 12;
 *   the selected tab is a card pill with weight 600 and a hairline rim (never
 *   colour alone). 40 tall on desktop, 44px tabs on touch.
 * - `line`: 44px underline tabs (+ the 1px hairline) with a 3px --brand-solid
 *   bar under the active tab and weight 600.
 * - `default`: the neutral pre-redesign pill track, unchanged on purpose: the
 *   lesson games' RankingDialogs render it with their own colours and keep
 *   their own art. Do not restyle it; use `segmented` in app code.
 */
function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center text-fg-muted group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "rounded-lg bg-fill-muted p-[3px] group-data-horizontal/tabs:h-9",
        segmented:
          "rounded-(--radius-ctl) border border-clay-rim bg-surface-muted p-[3px] group-data-horizontal/tabs:h-10 pointer-coarse:group-data-horizontal/tabs:h-[52px]",
        line: "gap-5 rounded-none border-b border-hairline bg-transparent p-0 group-data-horizontal/tabs:h-[45px]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-full flex-1 items-center justify-center gap-1.5 border border-transparent px-3 py-0.5 text-sm font-medium whitespace-nowrap text-fg-muted transition-[color,background-color,box-shadow] duration-(--duration-fast) outline-none group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-fg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // default: the games' neutral pill (pre-redesign look)
        "group-data-[variant=default]/tabs-list:h-[calc(100%-1px)] group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:data-active:bg-surface group-data-[variant=default]/tabs-list:data-active:text-fg group-data-[variant=default]/tabs-list:data-active:shadow-sm dark:group-data-[variant=default]/tabs-list:text-muted-foreground dark:group-data-[variant=default]/tabs-list:hover:text-foreground dark:group-data-[variant=default]/tabs-list:data-active:bg-surface-elevated",
        // segmented: card pill, weight 600, hairline rim
        "group-data-[variant=segmented]/tabs-list:rounded-[9px] group-data-[variant=segmented]/tabs-list:data-active:bg-surface group-data-[variant=segmented]/tabs-list:data-active:font-semibold group-data-[variant=segmented]/tabs-list:data-active:text-fg group-data-[variant=segmented]/tabs-list:data-active:shadow-[0_1px_2px_rgb(40_30_15/0.10),0_0_0_1px_var(--clay-rim)]",
        // line: underline tabs, weight 600 + the bar below
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:px-0.5 group-data-[variant=line]/tabs-list:data-active:font-semibold group-data-[variant=line]/tabs-list:data-active:text-fg",
        "after:absolute after:rounded-full after:bg-brand-solid after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:-bottom-px group-data-horizontal/tabs:after:h-[3px] group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-[3px] group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
