import { LoadingAnnouncement, Skeleton } from "@/components/app";

/** Mirrors the schedule page: toolbar, week strip + day agenda, then the stat strip and next-session card. */
export default function ScheduleLoading() {
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <LoadingAnnouncement />
      {/* The loaded header's line boxes (title 28/1.3 from md, one-line description 14/1.6), so the strip below does not jump when the page arrives. */}
      <div aria-hidden="true" className="flex flex-col">
        <div className="hidden h-[2.275rem] items-center md:flex">
          <Skeleton className="h-7 w-56" />
        </div>
        <div className="mt-0.5 flex h-[1.4rem] items-center">
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div aria-hidden="true" className="flex min-w-0 flex-col gap-6">
          {/* Same order, sizes and wrapping as the loaded toolbar: view switch first on phones (42, 52 on touch), date nav 40 (44 on touch). */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <Skeleton className="h-10 w-full rounded-(--radius-ctl) sm:w-[21.75rem] sm:max-w-full pointer-coarse:h-11" />
            <Skeleton className="h-[42px] w-full rounded-(--radius-ctl) max-sm:order-first sm:ml-auto sm:w-56 pointer-coarse:h-[52px]" />
          </div>
          {/* Same columns, gap and edge-to-edge card below 360px as the loaded week strip (schedule-client.tsx). */}
          <div className="grid grid-cols-[repeat(7,minmax(2.75rem,1fr))] gap-x-[clamp(0px,(100%_-_19.25rem)/6,0.25rem)] overflow-hidden rounded-(--radius-card) border border-clay-rim bg-surface p-1.5 max-[360px]:mx-[calc(var(--gutter)*-1)] max-[360px]:rounded-none max-[360px]:border-x-0 sm:gap-x-1.5 sm:p-2">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-[68px] rounded-(--radius-ctl)" />
            ))}
          </div>
          {[2, 1].map((rows, day) => (
            <div key={day} className="flex flex-col gap-2">
              <Skeleton className="mx-1 h-5 w-40" />
              <div className="overflow-hidden rounded-(--radius-card) border border-clay-rim bg-surface">
                {Array.from({ length: rows }, (_, i) => (
                  <div key={i} className="flex min-h-[68px] items-center gap-3.5 border-hairline px-4 py-2.5 [&+&]:border-t">
                    <div className="flex w-[52px] flex-col gap-1.5">
                      <Skeleton className="h-4 w-11" />
                      <Skeleton className="h-3 w-9" />
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="flex flex-col gap-6">
          <div className="grid grid-cols-2 overflow-hidden rounded-(--radius-card) border border-clay-rim bg-surface">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-2 px-4 py-3.5 [&+&]:border-l [&+&]:border-hairline">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-6 w-14" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-(--radius-card) border border-clay-rim bg-surface p-4 md:p-5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
