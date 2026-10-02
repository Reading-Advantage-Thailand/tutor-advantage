"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { fieldControlClass } from "@/components/app/constants"

/**
 * Select (legacy shadcn API, radix removed): renders a styled NATIVE
 * <select> (OS picker on phones, accessible, zero JS). The JSX tree
 *   <Select value onValueChange><SelectTrigger id className><SelectValue placeholder/></SelectTrigger>
 *     <SelectContent><SelectItem value>Label</SelectItem>…</SelectContent></Select>
 * is read once per render to build the <option>s, so existing call sites work
 * unchanged. New code: <SelectField options=… /> from "@/components/app".
 */

interface ItemProps {
  value: string
  disabled?: boolean
  children?: React.ReactNode
  className?: string
}

function SelectItem(props: ItemProps): React.ReactElement | null {
  void props
  return null
}
function SelectValue(props: { placeholder?: React.ReactNode; className?: string }): React.ReactElement | null {
  void props
  return null
}
function SelectTrigger(props: React.ComponentProps<"button"> & { size?: "sm" | "default" }): React.ReactElement | null {
  void props
  return null
}
function SelectContent(props: { children?: React.ReactNode; className?: string; position?: string; align?: string }): React.ReactElement | null {
  void props
  return null
}
function SelectGroup(props: { children?: React.ReactNode }): React.ReactElement | null {
  void props
  return null
}
function SelectLabel(props: { children?: React.ReactNode; className?: string }): React.ReactElement | null {
  void props
  return null
}
function SelectSeparator(): React.ReactElement | null {
  return null
}
function SelectScrollUpButton(): React.ReactElement | null {
  return null
}
function SelectScrollDownButton(): React.ReactElement | null {
  return null
}

function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children)
  return ""
}

type Option = { kind: "option"; value: string; label: string; disabled?: boolean } | { kind: "group"; label: string; options: Option[] }

interface Parsed {
  trigger?: React.ComponentProps<"button"> & { size?: "sm" | "default" }
  placeholder?: string
  options: Option[]
}

function collect(children: React.ReactNode, parsed: Parsed, into: Option[]) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as Record<string, unknown> & { children?: React.ReactNode }
    if (child.type === SelectTrigger) {
      parsed.trigger = props as Parsed["trigger"]
      collect(props.children, parsed, into)
    } else if (child.type === SelectValue) {
      if (props.placeholder !== undefined) parsed.placeholder = textOf(props.placeholder as React.ReactNode)
    } else if (child.type === SelectItem) {
      into.push({ kind: "option", value: String(props.value), label: textOf(props.children), disabled: Boolean(props.disabled) })
    } else if (child.type === SelectGroup) {
      const options: Option[] = []
      let label = ""
      React.Children.forEach(props.children, (groupChild) => {
        if (React.isValidElement(groupChild) && groupChild.type === SelectLabel) {
          label = textOf((groupChild.props as { children?: React.ReactNode }).children)
        }
      })
      collect(props.children, parsed, options)
      if (label) into.push({ kind: "group", label, options })
      else into.push(...options)
    } else if (child.type === React.Fragment || child.type === SelectContent) {
      collect(props.children, parsed, into)
    }
  })
}

function renderOptions(options: Option[]): React.ReactNode {
  return options.map((option, index) =>
    option.kind === "group" ? (
      <optgroup key={`g-${index}`} label={option.label}>
        {renderOptions(option.options)}
      </optgroup>
    ) : (
      <option key={option.value} value={option.value} disabled={option.disabled}>
        {option.label}
      </option>
    )
  )
}

function Select<V extends string = string>({
  value,
  defaultValue,
  onValueChange,
  disabled,
  required,
  name,
  children,
}: {
  value?: V
  defaultValue?: V
  onValueChange?: (value: V) => void
  disabled?: boolean
  required?: boolean
  name?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const parsed: Parsed = { options: [] }
  collect(children, parsed, parsed.options)
  const trigger = parsed.trigger ?? {}
  const controlled = value !== undefined
  const showPlaceholder = parsed.placeholder !== undefined && (controlled ? value === "" || value === undefined : !defaultValue)
  return (
    <span data-slot="select" className={cn("relative inline-flex min-w-0", trigger.className?.includes("w-full") && "w-full")}>
      <select
        id={trigger.id}
        name={name}
        aria-label={trigger["aria-label"]}
        aria-invalid={trigger["aria-invalid"]}
        disabled={disabled || trigger.disabled}
        required={required}
        {...(controlled ? { value: value ?? "" } : { defaultValue: defaultValue ?? (parsed.placeholder !== undefined ? "" : undefined) })}
        onChange={(event) => onValueChange?.(event.target.value as V)}
        data-slot="select-trigger"
        className={cn(
          fieldControlClass,
          "h-9 cursor-pointer appearance-none pr-8 pointer-coarse:h-11",
          trigger.size === "sm" && "h-8",
          trigger.className
        )}
      >
        {parsed.placeholder !== undefined ? (
          <option value="" disabled hidden={!showPlaceholder}>
            {parsed.placeholder}
          </option>
        ) : null}
        {renderOptions(parsed.options)}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-subtle" />
    </span>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
