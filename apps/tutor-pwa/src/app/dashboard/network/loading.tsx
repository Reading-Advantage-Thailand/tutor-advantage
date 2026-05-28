export default function NetworkLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-9 w-36 bg-muted rounded-2xl" />
        <div className="h-4 w-56 bg-muted rounded-xl" />
      </div>

      {/* Invite link skeleton */}
      <div className="rounded-3xl border border-border/40 p-5 bg-card">
        <div className="h-10 bg-muted rounded-xl" />
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-border/40 p-5 bg-card space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="h-3 w-20 bg-muted rounded-xl" />
                <div className="h-7 w-14 bg-muted rounded-xl" />
              </div>
              <div className="h-11 w-11 rounded-2xl bg-muted" />
            </div>
          </div>
        ))}
      </div>

      {/* Network tree skeleton */}
      <div className="rounded-3xl border border-border/40 bg-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="h-5 w-36 bg-muted rounded-xl" />
        </div>
        <div className="h-[400px] bg-muted/30" />
      </div>
    </div>
  );
}
