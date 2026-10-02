// src/components/ui/input.tsx
import * as React from "react";

import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full min-w-0 rounded-lg border border-field-border bg-surface px-3 py-1 text-sm text-fg transition-[border-color,box-shadow] duration-150 outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg placeholder:text-fg-subtle focus-visible:border-brand-vivid focus-visible:ring-3 focus-visible:ring-brand-vivid/20 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 aria-[invalid=true]:border-danger-fg aria-[invalid=true]:focus-visible:ring-danger-fg/20",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
