"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  BookOpen,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { studentApi } from "@/lib/api";
import { studentScheduleCopy, t } from "@/lib/i18n";

interface ScheduledEvent {
  id: string;
  classId: string;
  title: string;
  tutor: string;
  time: string;
  type: "class" | "reminder" | "event";
  dateStr: string; // YYYY-MM-DD
}

function extractTime(str: string) {
  const regex = /(\d{1,2}[:.]\d{2})\s*[-\u2013]\s*(\d{1,2}[:.]\d{2})/;
  const match = str.match(regex);
  if (match) {
    return `${match[1].replace(".", ":")} - ${match[2].replace(".", ":")} ${t("schedule.timeSuffix")}`;
  }
  return t("schedule.byAppointment");
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseThaiSchedule(scheduleStr: string) {
  if (!scheduleStr || scheduleStr === t("schedule.unset")) {
    return { days: [1, 3, 5], timeRange: t("schedule.unset") };
  }

  const lowerStr = scheduleStr.toLowerCase();
  const dayMapping: { [key: string]: number } = studentScheduleCopy.dayMapping;

  const detectedDays: number[] = [];

  // Check for specific Thai days
  Object.entries(dayMapping).forEach(([name, val]) => {
    if (lowerStr.includes(name)) {
      if (!detectedDays.includes(val)) detectedDays.push(val);
    }
  });

  // Explicit "every day" schedule means all 7 days.
  if (lowerStr.includes(studentScheduleCopy.everyDay) && detectedDays.length === 0) {
    return {
      days: [0, 1, 2, 3, 4, 5, 6],
      timeRange: extractTime(scheduleStr),
    };
  }

  // Try extracting time
  const timeRange = extractTime(scheduleStr);

  // Default if couldn't detect anything (maybe it's some random text)
  if (detectedDays.length === 0) {
    return { days: [1, 3, 5], timeRange }; // Fallback to M/W/F
  }

  return { days: detectedDays, timeRange };
}

export default function SchedulePage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        setLoading(true);
        const data = await studentApi.getEnrolledClasses();
        const classes = data.classes || [];

        const generatedEvents: ScheduledEvent[] = [];
        const now = new Date();

        // Set start to 30 days ago, end to 60 days forward
        const startDate = new Date();
        startDate.setDate(now.getDate() - 30);
        const endDate = new Date();
        endDate.setDate(now.getDate() + 60);

        classes.forEach(
          (cls: {
            id: string;
            name: string;
            tutorName: string;
            nextSession: string;
            startsAt?: string | null;
            endsAt?: string | null;
          }) => {
            const schedStr = cls.nextSession || "";
            const { days, timeRange } = parseThaiSchedule(schedStr);

            // Respect class start/end dates — clamp to window bounds
            const clsStart = cls.startsAt ? new Date(cls.startsAt) : startDate;
            const clsEnd   = cls.endsAt   ? new Date(cls.endsAt)   : endDate;
            const loopStart = clsStart > startDate ? clsStart : startDate;
            const loopEnd   = clsEnd   < endDate   ? clsEnd   : endDate;

            // Generate occurrences
            const loopDate = new Date(loopStart);
            while (loopDate <= loopEnd) {
              const dayOfWeek = loopDate.getDay();
              if (days.includes(dayOfWeek)) {
                const dStr = toLocalDateStr(loopDate);
                generatedEvents.push({
                  id: `${cls.id}-${dStr}`,
                  classId: cls.id,
                  title: cls.name,
                  tutor: cls.tutorName,
                  time: timeRange,
                  type: "class",
                  dateStr: dStr,
                });
              }
              // Advance one day
              loopDate.setDate(loopDate.getDate() + 1);
            }
          },
        );

        setEvents(generatedEvents);
      } catch (err) {
        console.error("Error fetching classes for schedule:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSchedule();
  }, []);

  // Helper function for generating calendar grid
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Day of week for first day (0 for Sun, 6 for Sat)
    const startingDayOfWeek = firstDay.getDay();

    const totalDays = [];

    // Get days from previous month
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      totalDays.push({
        day: prevLastDay - i,
        month: "prev",
        date: new Date(year, month - 1, prevLastDay - i),
      });
    }

    // Get current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      totalDays.push({
        day: i,
        month: "curr",
        date: new Date(year, month, i),
      });
    }

    // Next month padding
    const remainingCells = 42 - totalDays.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingCells; i++) {
      totalDays.push({
        day: i,
        month: "next",
        date: new Date(year, month + 1, i),
      });
    }

    return totalDays;
  };

  const days = getDaysInMonth(currentDate);
  const thaiMonths = studentScheduleCopy.months;
  const daysOfWeek = studentScheduleCopy.daysOfWeek;

  const handlePrevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  const handleNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const selectedDateStr = toLocalDateStr(selectedDate);
  const selectedEvents = events
    .filter((ev) => ev.dateStr === selectedDateStr)
    .sort((a, b) => a.time.localeCompare(b.time));

  const eventsOnDate = (d: Date) => {
    const dStr = toLocalDateStr(d);
    return events.filter((ev) => ev.dateStr === dStr);
  };

  return (
    <div
      style={{
        background: "var(--surface-bg)",
        minHeight: "100dvh",
        paddingBottom: 100,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--surface-nav)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderBottom: "1px solid var(--surface-border)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard")}
          style={{ borderRadius: 12, color: "var(--neutral-600)" }}
        >
          <ChevronLeft size={22} />
        </Button>
        <h1
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {t("schedule.title")}
        </h1>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Calendar Card */}
        <Card
          style={{
            borderRadius: 24,
            overflow: "hidden",
            border: "none",
            boxShadow:
              "0 10px 25px -5px rgba(0,0,0,0.05), 0 4px 10px -5px rgba(0,0,0,0.02)",
          }}
        >
          <CardContent style={{ padding: "20px" }}>
            {/* Calendar Navigation */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h2
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {thaiMonths[currentDate.getMonth()]}{" "}
                {currentDate.getFullYear() + 543}
              </h2>
              <div style={{ display: "flex", gap: 6 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevMonth}
                  className="h-8 w-8 rounded-full bg-muted hover:bg-accent"
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextMonth}
                  className="h-8 w-8 rounded-full bg-muted hover:bg-accent"
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            {/* Calendar Grid Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 4,
                marginBottom: 12,
              }}
            >
              {daysOfWeek.map((day, idx) => (
                <div
                  key={day}
                  style={{
                    textAlign: "center",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color:
                      idx === 0 || idx === 6
                        ? "var(--neutral-400)"
                        : "var(--neutral-500)",
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "6px 4px",
              }}
            >
              {days.map((dayObj, i) => {
                const isSelected = isSameDay(dayObj.date, selectedDate);
                const isToday = isSameDay(dayObj.date, new Date());
                const hasEvents = eventsOnDate(dayObj.date).length > 0;
                const isInactive = dayObj.month !== "curr";

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(dayObj.date)}
                    style={{
                      background: isSelected
                        ? "var(--brand-500)"
                        : "transparent",
                      color: isSelected
                        ? "white"
                        : isInactive
                          ? "var(--neutral-300)"
                          : "var(--text-primary)",
                      border: "none",
                      borderRadius: 12,
                      aspectRatio: "1 / 1",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      fontWeight: isToday || isSelected ? 700 : 500,
                      fontSize: "0.875rem",
                      cursor: "pointer",
                      outline: "none",
                      transition: "all 0.2s ease",
                    }}
                    className="hover:bg-accent active:scale-95"
                  >
                    {isToday && !isSelected && (
                      <div
                        style={{
                          position: "absolute",
                          width: "100%",
                          height: "100%",
                          border: "2px solid var(--brand-200)",
                          borderRadius: 12,
                          top: 0,
                          left: 0,
                        }}
                      />
                    )}
                    <span>{dayObj.day}</span>
                    {hasEvents && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 6,
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: isSelected ? "white" : "var(--brand-500)",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Daily Schedule Details */}
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 16,
            }}
          >
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {isSameDay(selectedDate, new Date())
                ? t("schedule.todayTitle")
                : `${t("schedule.dateTitlePrefix")} ${selectedDate.getDate()} ${thaiMonths[selectedDate.getMonth()]}`}
            </h3>
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--neutral-500)",
                fontWeight: 500,
              }}
            >
              {selectedEvents.length} {t("schedule.itemUnit")}
            </span>
          </div>

          {loading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "40px 0",
              }}
            >
              <div className="animate-spin h-6 w-6 border-2 border-brand-500 border-t-transparent rounded-full"></div>
            </div>
          ) : selectedEvents.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {selectedEvents.map((ev, index) => (
                <Card
                  key={ev.id}
                  onClick={() => router.push(`/lesson/${ev.classId}`)}
                  className="cursor-pointer active:scale-[0.98] transition-transform duration-200"
                  style={{
                    borderRadius: 16,
                    border: "1px solid var(--surface-border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <CardContent
                    style={{ padding: "16px", display: "flex", gap: 16 }}
                  >
                    <div
                      style={{
                        width: 4,
                        borderRadius: 4,
                        background: `hsl(${120 + index * 30}, 70%, 45%)`,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 4,
                        }}
                      >
                        <h4
                          style={{
                            fontWeight: 700,
                            fontSize: "0.9375rem",
                            color: "var(--text-primary)",
                          }}
                        >
                          {ev.title}
                        </h4>
                        <Badge
                          variant="secondary"
                          style={{
                            fontSize: "0.65rem",
                            background: "var(--brand-100)",
                            color: "var(--brand-600)",
                            border: "none",
                          }}
                        >
                          {t("schedule.classBadge")}
                        </Badge>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          marginTop: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: "0.8125rem",
                            color: "var(--neutral-500)",
                          }}
                        >
                          <Clock size={14} />
                          <span>{ev.time}</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: "0.8125rem",
                            color: "var(--neutral-500)",
                          }}
                        >
                          <BookOpen size={14} />
                          <span>{t("schedule.tutorPrefix")} {ev.tutor}</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.8125rem",
                            color: "var(--brand-600)",
                            fontWeight: 600,
                          }}
                        >
                          <MapPin size={14} />
                          <span>{t("schedule.enterClassroom")}</span>
                          <ChevronRight size={14} style={{ marginLeft: 2 }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                background: "var(--surface-card)",
                borderRadius: 20,
                border: "1px dashed var(--surface-border)",
                color: "var(--text-tertiary)",
              }}
            >
              <CalendarIcon
                size={32}
                style={{ margin: "0 auto 12px", opacity: 0.6 }}
              />
              <p style={{ fontSize: "0.875rem" }}>{t("schedule.emptyDay")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
