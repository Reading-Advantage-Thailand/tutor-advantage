"use client";

/** Last-resort boundary (root layout failed): plain HTML, no providers. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="th">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>เกิดข้อผิดพลาด</h1>
          <p style={{ color: "#475569" }}>ไม่สามารถแสดงหน้านี้ได้ กรุณาลองใหม่อีกครั้ง</p>
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8 }}>
            ลองใหม่
          </button>
        </div>
      </body>
    </html>
  );
}
