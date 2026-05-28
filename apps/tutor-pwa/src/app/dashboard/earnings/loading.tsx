export default function EarningsLoading() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full animate-pulse">
      <div className="space-y-2">
        <div className="h-9 w-32 bg-muted rounded-2xl" />
        <div className="h-4 w-48 bg-muted rounded-xl" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-border/40 p-5 bg-card space-y-3">
            <div className="h-10 w-10 rounded-2xl bg-muted" />
            <div className="h-7 w-24 bg-muted rounded-xl" />
            <div className="h-3 w-20 bg-muted rounded-xl" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-3xl border border-border/40 p-6 bg-card">
        <div className="h-5 w-32 bg-muted rounded-xl mb-6" />
        <div className="h-64 bg-muted rounded-2xl" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-3xl border border-border/40 bg-card overflow-hidden">
        <div className="p-6 border-b border-border/40">
          <div className="h-5 w-40 bg-muted rounded-xl" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-5 border-b border-border/30 flex items-center justify-between gap-4">
            <div className="h-4 w-36 bg-muted rounded-xl" />
            <div className="h-4 w-20 bg-muted rounded-xl" />
            <div className="h-4 w-24 bg-muted rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
