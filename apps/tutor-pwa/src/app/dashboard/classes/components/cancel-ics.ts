/** Downloads an iCalendar CANCEL file so the class disappears from the tutor's phone calendar. */
export function triggerCancelICS(classId: string, className: string) {
  const dtstamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const content = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tutor Advantage//TH",
    "CALSCALE:GREGORIAN", "METHOD:CANCEL",
    "BEGIN:VEVENT",
    `UID:${classId}@ta.th`, `DTSTAMP:${dtstamp}`,
    `SUMMARY:${className}`, "STATUS:CANCELLED",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cancel-${className.replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
