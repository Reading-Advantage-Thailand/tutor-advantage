export default function DashboardLoading() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-48 bg-muted rounded-2xl" />
          <div className="h-4 w-64 bg-muted rounded-xl" />
        </div>
        <div className="hidden sm:block h-10 w-32 bg-muted rounded-xl" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-border/40 p-5 sm:p-6 space-y-4 bg-card">
            <div className="flex items-center justify-between">
              <div className="h-11 w-11 rounded-2xl bg-muted" />
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
            <div className="h-8 w-20 bg-muted rounded-xl" />
            <div className="h-3 w-24 bg-muted rounded-xl" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="rounded-3xl border border-border/40 p-6 bg-card space-y-4 lg:order-last">
          <div className="h-5 w-32 bg-muted rounded-xl" />
          <div className="h-20 bg-muted rounded-2xl" />
          <div className="h-4 bg-muted rounded-xl" />
          <div className="h-4 w-3/4 bg-muted rounded-xl" />
        </div>
        <div className="lg:col-span-2 rounded-3xl border border-border/40 bg-card overflow-hidden">
          <div className="p-6 border-b border-border/40">
            <div className="h-5 w-32 bg-muted rounded-xl" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-6 border-b border-border/30 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-48 bg-muted rounded-xl" />
                <div className="h-3 w-36 bg-muted rounded-xl" />
              </div>
              <div className="h-6 w-16 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
