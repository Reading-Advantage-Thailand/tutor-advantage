export default function PerformanceLoading() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full animate-pulse">
      <div className="space-y-2">
        <div className="h-9 w-40 bg-muted rounded-2xl" />
        <div className="h-4 w-52 bg-muted rounded-xl" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-border/40 p-5 bg-card space-y-3">
            <div className="h-10 w-10 rounded-2xl bg-muted" />
            <div className="h-7 w-20 bg-muted rounded-xl" />
            <div className="h-3 w-24 bg-muted rounded-xl" />
          </div>
        ))}
      </div>

      {/* Chart/graph area */}
      <div className="rounded-3xl border border-border/40 p-6 bg-card space-y-4">
        <div className="h-5 w-36 bg-muted rounded-xl" />
        <div className="h-64 bg-muted rounded-2xl" />
      </div>

      {/* Badge/ranking skeleton */}
      <div className="rounded-3xl border border-border/40 p-6 bg-card space-y-4">
        <div className="h-5 w-28 bg-muted rounded-xl" />
        <div className="flex gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-1 h-24 bg-muted rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
