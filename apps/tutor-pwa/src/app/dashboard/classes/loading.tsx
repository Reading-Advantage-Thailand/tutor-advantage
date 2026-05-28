export default function ClassesLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-32 bg-muted rounded-2xl" />
          <div className="h-4 w-48 bg-muted rounded-xl" />
        </div>
        <div className="h-10 w-28 bg-muted rounded-xl" />
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-9 w-20 bg-muted rounded-xl" />
        ))}
      </div>

      {/* Class cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-border/40 p-5 bg-card space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="h-5 w-36 bg-muted rounded-xl" />
              <div className="h-6 w-16 bg-muted rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-28 bg-muted rounded-xl" />
              <div className="h-3 w-20 bg-muted rounded-xl" />
            </div>
            <div className="h-9 bg-muted rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
