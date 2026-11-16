"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * One row action in an admin table (classes, coupons, discount codes).
 * Table (md+): a 32px icon-only button (44 under pointer: coarse) so the row
 * stays on one line; the word is its accessible name and its hover title.
 * Phone list rows: icon + word. Danger actions use the tonal red variant and
 * open a ConfirmDialog; neutral ones stay grey like other icon-only ghosts.
 */
export function RowAction({
  icon: Icon,
  label,
  href,
  onClick,
  danger,
  "aria-label": ariaLabel,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  /** Longer accessible name when the word alone is ambiguous. */
  "aria-label"?: string;
}) {
  const className = cn("md:w-8 md:px-0", !danger && "md:text-fg-muted md:hover:text-fg");
  const content = (
    <>
      <Icon aria-hidden="true" />
      <span className="md:sr-only">{label}</span>
    </>
  );
  if (href) {
    return (
      <Button asChild size="sm" variant={danger ? "destructive" : "ghost"} className={className}>
        <Link href={href} title={label} aria-label={ariaLabel}>
          {content}
        </Link>
      </Button>
    );
  }
  return (
    <Button type="button" size="sm" variant={danger ? "destructive" : "ghost"} className={className} title={label} aria-label={ariaLabel} onClick={onClick}>
      {content}
    </Button>
  );
}

/**
 * An empty slot the size of a table RowAction, for a row that lacks an
 * optional action: every icon then keeps its place from row to row. Table
 * only (nothing in the phone list), never focusable, hidden from assistive tech.
 */
export function RowActionSlot() {
  return <span aria-hidden="true" className="hidden shrink-0 md:block md:h-8 md:w-8 pointer-coarse:min-w-11" />;
}

/**
 * The actions cell: a labelled group, a wrapping row of labelled buttons on
 * phones (the card's full-width actions row, DataTable mobile: "actions") and
 * one right-aligned line in the table.
 */
export function RowActions({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span role="group" aria-label={label} className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end md:gap-1">
      {children}
    </span>
  );
}
