export default function ScheduleLoading() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-pulse">
      {/* Calendar skeleton */}
      <div className="lg:col-span-8">
        <div className="rounded-3xl border border-border/40 bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="h-7 w-36 bg-muted rounded-2xl" />
            <div className="flex gap-2">
              <div className="h-9 w-9 bg-muted rounded-xl" />
              <div className="h-9 w-9 bg-muted rounded-xl" />
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2 gap-1">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-7 bg-muted rounded-lg" />
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="h-16 sm:h-24 bg-muted/50 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Day summary skeleton */}
      <div className="lg:col-span-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-24 bg-muted rounded-xl" />
          <div className="h-6 w-20 bg-muted rounded-full" />
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/40 p-4 bg-card space-y-3">
              <div className="h-4 w-36 bg-muted rounded-xl" />
              <div className="h-6 w-24 bg-muted rounded-lg" />
              <div className="flex gap-4">
                <div className="h-3 w-20 bg-muted rounded-xl" />
                <div className="h-3 w-16 bg-muted rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
