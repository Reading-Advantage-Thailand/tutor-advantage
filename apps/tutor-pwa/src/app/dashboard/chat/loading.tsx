export default function ChatLoading() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto w-full animate-pulse">
      <div className="space-y-2">
        <div className="h-9 w-24 bg-muted rounded-2xl" />
        <div className="h-4 w-48 bg-muted rounded-xl" />
      </div>

      {/* Search bar skeleton */}
      <div className="h-14 bg-muted rounded-2xl" />

      {/* Conversation items skeleton */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-border/40 p-4 sm:p-5 bg-card flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 bg-muted rounded-xl" />
                <div className="h-4 w-12 bg-muted rounded-xl" />
              </div>
              <div className="h-3 w-20 bg-muted rounded-xl" />
              <div className="h-3 w-48 bg-muted rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
