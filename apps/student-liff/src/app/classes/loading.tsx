export default function ClassesLoading() {
  return (
    <div style={{ padding: "0" }}>
      {/* Top bar skeleton */}
      <div
        style={{
          height: 56,
          background: "var(--surface-card)",
          borderBottom: "1px solid var(--surface-border)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
        }}
      >
        <div
          className="animate-pulse"
          style={{ height: 18, width: "35%", borderRadius: 8, background: "var(--neutral-200)" }}
        />
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Search + QR row skeleton */}
        <div style={{ display: "flex", gap: 10 }}>
          <div
            className="animate-pulse"
            style={{ flex: 1, height: 48, borderRadius: 16, background: "var(--neutral-200)" }}
          />
          <div
            className="animate-pulse"
            style={{ width: 48, height: 48, borderRadius: 16, background: "var(--neutral-200)", flexShrink: 0 }}
          />
        </div>

        {/* Filter chips skeleton */}
        <div style={{ display: "flex", gap: 8 }}>
          {[80, 90, 100, 70, 80].map((w, i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{ height: 34, width: w, borderRadius: 999, background: "var(--neutral-200)", flexShrink: 0 }}
            />
          ))}
        </div>

        {/* Class card skeletons */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="glass-card"
            style={{ width: "100%", height: 140, borderRadius: 16, overflow: "hidden" }}
          >
            <div style={{ display: "flex", height: "100%" }}>
              <div
                className="animate-pulse"
                style={{ width: 4, height: "100%", borderRadius: 0, background: "var(--neutral-300)" }}
              />
              <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="animate-pulse" style={{ height: 18, width: "65%", borderRadius: 8, background: "var(--neutral-200)" }} />
                <div className="animate-pulse" style={{ height: 14, width: "40%", borderRadius: 8, background: "var(--neutral-200)" }} />
                <div className="animate-pulse" style={{ height: 8, width: "100%", borderRadius: 8, background: "var(--neutral-200)" }} />
                <div className="animate-pulse" style={{ height: 14, width: "30%", borderRadius: 8, background: "var(--neutral-200)" }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
