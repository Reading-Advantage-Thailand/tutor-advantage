import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal `asChild` support (replaces radix Slot): merges className and props
 * onto the single child element. Child props win except className, which is
 * merged, and event handlers, which both run.
 */
export function Slot({ children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  if (!React.isValidElement(children)) return null;
  const child = children as React.ReactElement<Record<string, unknown>>;
  const childProps = child.props;
  const merged: Record<string, unknown> = { ...props, ...childProps };
  for (const key of Object.keys(props)) {
    const ours = (props as Record<string, unknown>)[key];
    const theirs = childProps[key];
    if (/^on[A-Z]/.test(key) && typeof ours === "function" && typeof theirs === "function") {
      merged[key] = (...args: unknown[]) => {
        (theirs as (...a: unknown[]) => void)(...args);
        (ours as (...a: unknown[]) => void)(...args);
      };
    }
  }
  merged.className = cn(props.className, childProps.className as string | undefined);
  return React.cloneElement(child, merged);
}
