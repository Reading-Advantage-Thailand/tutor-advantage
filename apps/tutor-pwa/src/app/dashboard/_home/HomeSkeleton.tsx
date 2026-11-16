import type { ReactNode } from "react";
import { LoadingAnnouncement, Skeleton } from "@/components/app";
import { cn } from "@/lib/utils";

function CardBlock({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn("ds-card", className)}>{children}</div>;
}

function RowsBlock({ rows }: { rows: number }) {
  return (
    <CardBlock className="overflow-hidden">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={cn("flex min-h-[68px] items-center gap-3.5 px-4 py-2.5", index > 0 && "border-t border-hairline")}>
          <Skeleton className="h-9 w-10 shrink-0 rounded-(--radius-tile)" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      ))}
    </CardBlock>
  );
}

function SectionHead({ wide }: { wide?: boolean }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <Skeleton className={cn("h-5", wide ? "w-44" : "w-32")} />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

/**
 * Home loading state (patterns.md "Loading": skeletons shaped like the final
 * layout): greeting, wallet hero, next-class card, stat strip, today's rows,
 * week grid (desktop) and recent classes, in the same grid as the page so
 * nothing jumps when the data arrives. Server component.
 */
export function HomeSkeleton() {
  return (
    <div className="mx-auto flex w-full min-w-0 flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      <div aria-hidden="true" className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="hidden h-4 w-48 lg:block" />
          <Skeleton className="h-7 w-64 max-w-full lg:h-9 lg:w-96" />
          <Skeleton className="h-4 w-60 max-w-full" />
        </div>
        <Skeleton className="hidden h-10 w-36 rounded-(--radius-ctl) md:block" />
      </div>

      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-5"
      >
        {/* Wallet: a muted block in the hero's shape (no ink while loading). */}
        <CardBlock className="flex flex-col gap-3 p-[18px] lg:col-start-1 lg:row-start-1 lg:min-h-[140px]">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="mt-2 h-2.5 w-full rounded-full lg:hidden" />
        </CardBlock>
        <CardBlock className="flex flex-col gap-3 px-[18px] pt-4 pb-[18px] lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-7 w-32 rounded-full" />
          <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 pt-1">
            <Skeleton className="h-12 rounded-(--radius-ctl)" />
            <Skeleton className="h-12 w-24 rounded-(--radius-ctl)" />
          </div>
        </CardBlock>
        <CardBlock className="grid grid-cols-3 overflow-hidden lg:col-start-1 lg:row-start-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className={cn("flex flex-col justify-center gap-2 px-3 py-3.5 sm:px-4", index > 0 && "border-l border-hairline")}>
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-6 w-10" />
            </div>
          ))}
        </CardBlock>
      </div>

      <div aria-hidden="true" className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2 lg:gap-5">
          <div className="flex flex-col gap-2">
            <SectionHead />
            <RowsBlock rows={2} />
          </div>
          <div className="hidden flex-col gap-2 lg:flex">
            <SectionHead wide />
            <CardBlock className="flex flex-col gap-3 p-4">
              {Array.from({ length: 7 }, (_, index) => (
                <Skeleton key={index} className="h-5 w-full" />
              ))}
            </CardBlock>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <SectionHead />
          <RowsBlock rows={3} />
        </div>
      </div>
    </div>
  );
}
