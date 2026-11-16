// src/components/ui/input.tsx
import * as React from "react";

import { fieldControlClass } from "@/components/app/constants";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/** Legacy shadcn input with the tutor field styling (44 desktop, 48 on touch). */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          fieldControlClass,
          "flex h-11 py-1 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg pointer-coarse:h-12",
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
