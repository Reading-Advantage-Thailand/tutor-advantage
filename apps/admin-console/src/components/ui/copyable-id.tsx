"use client";

import { IdCell } from "@/components/app/IdCell";

/**
 * @deprecated Use <IdCell id label? /> from "@/components/app".
 */
interface CopyableIdProps {
  /** Label shown above the ID */
  name?: string;
  id: string;
  variant?: "label" | "name";
}

export function CopyableId({ name, id, variant = "label" }: CopyableIdProps) {
  return (
    <div className="min-w-0">
      {name ? (
        <p className={variant === "name" ? "mb-0.5 text-xs font-semibold text-fg" : "mb-0.5 text-xs text-fg-muted"}>{name}</p>
      ) : null}
      <IdCell id={id} />
    </div>
  );
}
