export default function DashboardLoading() {
  return (
    <div className="page-shell">
      <div className="page-content" style={{ padding: "0 0 72px" }}>
        {/* Header skeleton */}
        <div
          style={{
            background: "var(--surface-card)",
            padding: "16px",
            borderBottom: "1px solid var(--surface-border)",
          }}
        >
          <div
            className="animate-pulse"
            style={{ height: 20, width: "40%", borderRadius: 8, background: "var(--neutral-200)" }}
          />
          <div
            className="animate-pulse"
            style={{ height: 14, width: "25%", borderRadius: 8, background: "var(--neutral-200)", marginTop: 8 }}
          />
        </div>

        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Stats row skeleton */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass-card animate-pulse"
                style={{ height: 72, borderRadius: 16 }}
              />
            ))}
          </div>

          {/* Quick menu skeleton */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{ height: 64, borderRadius: 16, background: "var(--neutral-200)" }}
              />
            ))}
          </div>

          {/* Class cards skeleton */}
          {[1, 2].map((i) => (
            <div
              key={i}
              className="glass-card animate-pulse"
              style={{ height: 120, borderRadius: 16 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
