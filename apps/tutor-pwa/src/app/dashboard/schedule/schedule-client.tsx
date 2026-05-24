"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  BookOpen,
  CalendarDays,
  ExternalLink,
  CalendarPlus,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

interface ScheduledEvent {
  id: string;
  classId: string;
  title: string;
  book: string;
  students: number;
  time: string;
  dateStr: string; // YYYY-MM-DD
  schedule: string; // raw scheduleDescription for ICS
  startsAt?: string | null;
  endsAt?: string | null;
}

export default function ScheduleClient({ initialClasses }: { initialClasses: any[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // 1. Parse Thai schedule string and extract event dates
  const allEvents = useMemo(() => {
    const events: ScheduledEvent[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 60); // past 60 days
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90); // future 90 days

    initialClasses.forEach((cls) => {
      const { days, timeRange } = parseThaiSchedule(cls.nextSession || "");

      // Respect class start/end dates — clamp to window bounds
      const clsStart = cls.startsAt ? new Date(cls.startsAt) : startDate;
      const clsEnd   = cls.endsAt   ? new Date(cls.endsAt)   : endDate;
      const loopStart = clsStart > startDate ? clsStart : startDate;
      const loopEnd   = clsEnd   < endDate   ? clsEnd   : endDate;

      const loopDate = new Date(loopStart);
      while (loopDate <= loopEnd) {
        if (days.includes(loopDate.getDay())) {
          const dStr = toLocalDateStr(loopDate);
          events.push({
            id: `${cls.id}-${dStr}`,
            classId: cls.id,
            title: cls.name,
            book: cls.book,
            students: cls.students,
            time: timeRange,
            dateStr: dStr,
            schedule: cls.nextSession || "",
            startsAt: cls.startsAt ?? null,
            endsAt: cls.endsAt ?? null,
          });
        }
        loopDate.setDate(loopDate.getDate() + 1);
      }
    });

    return events;
  }, [initialClasses]);

  // 2. Calendar state computation
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    
    const cells = [];
    const prevLastDay = new Date(year, month, 0).getDate();
    
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      cells.push({ day: prevLastDay - i, month: "prev", date: new Date(year, month - 1, prevLastDay - i) });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      cells.push({ day: i, month: "curr", date: new Date(year, month, i) });
    }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({ day: i, month: "next", date: new Date(year, month + 1, i) });
    }
    return cells;
  }, [currentDate]);

  const thaiMonths = [
    t("dashboardSchedule.months.jan"),
    t("dashboardSchedule.months.feb"),
    t("dashboardSchedule.months.mar"),
    t("dashboardSchedule.months.apr"),
    t("dashboardSchedule.months.may"),
    t("dashboardSchedule.months.jun"),
    t("dashboardSchedule.months.jul"),
    t("dashboardSchedule.months.aug"),
    t("dashboardSchedule.months.sep"),
    t("dashboardSchedule.months.oct"),
    t("dashboardSchedule.months.nov"),
    t("dashboardSchedule.months.dec"),
  ];
  const daysOfWeek = [
    t("dashboardSchedule.weekdays.sun"),
    t("dashboardSchedule.weekdays.mon"),
    t("dashboardSchedule.weekdays.tue"),
    t("dashboardSchedule.weekdays.wed"),
    t("dashboardSchedule.weekdays.thu"),
    t("dashboardSchedule.weekdays.fri"),
    t("dashboardSchedule.weekdays.sat"),
  ];

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  
  const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

  const eventsOnDate = (d: Date) => {
    const dStr = toLocalDateStr(d);
    return allEvents.filter(ev => ev.dateStr === dStr);
  };

  const selectedDateStr = toLocalDateStr(selectedDate);
  const selectedEvents = useMemo(() => 
    allEvents.filter(ev => ev.dateStr === selectedDateStr).sort((a, b) => a.time.localeCompare(b.time)),
    [allEvents, selectedDateStr]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

      {/* Left Column: Monthly Calendar View */}
      <div className="lg:col-span-8 animate-fade-in">
        <Card className="border border-border/40 hover:shadow-md rounded-3xl shadow-sm bg-card bg-gradient-to-br from-card via-card to-brand-500/2 dark:to-brand-500/5 transition-all duration-300 overflow-hidden">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black tracking-tight text-foreground">
                {thaiMonths[currentDate.getMonth()]} {currentDate.getFullYear() + 543}
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 hover:border-brand-500/30 transition-all duration-200" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 hover:border-brand-500/30 transition-all duration-200" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Week Header */}
            <div className="grid grid-cols-7 mb-2">
              {daysOfWeek.map((dw, idx) => (
                <div key={idx} className={cn("text-center text-xs font-bold py-2 text-muted-foreground uppercase tracking-wider", 
                  (idx === 0 || idx === 6) && "text-brand-500/70")}>
                  {dw}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {daysInMonth.map((dayObj, i) => {
                const isSelected = isSameDay(dayObj.date, selectedDate);
                const isToday = isSameDay(dayObj.date, new Date());
                const dayEvts = eventsOnDate(dayObj.date);
                const hasEvents = dayEvts.length > 0;
                const isInactive = dayObj.month !== "curr";

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(dayObj.date)}
                    className={cn(
                      "relative group min-h-[72px] sm:min-h-[96px] border rounded-2xl transition-all duration-300 flex flex-col items-start p-2 focus:outline-none hover-lift press-scale",
                      isSelected 
                        ? "border-brand-500 bg-brand-500/5 dark:bg-brand-500/10 shadow-[0_0_15px_rgba(6,199,85,0.12)] ring-1 ring-brand-500/30 z-10" 
                        : "border-border/30 hover:border-brand-500/20 hover:bg-brand-500/5 bg-muted/10 dark:bg-muted/5",
                      isInactive && "opacity-30"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-bold flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 mb-1",
                      isToday && !isSelected && "bg-brand-500 text-white shadow-md shadow-brand-500/20",
                      isSelected && "bg-brand-500 text-white shadow-md shadow-brand-500/30",
                      !isToday && !isSelected && "text-foreground group-hover:text-brand-500"
                    )}>
                      {dayObj.day}
                    </span>
                    
                    {/* Tiny dots or summaries on desktop view inside the cell */}
                    <div className="w-full flex flex-col gap-1 overflow-hidden mt-auto">
                      {dayEvts.slice(0, 2).map((evt, idx) => (
                        <div key={idx} className="hidden sm:block text-[9px] truncate leading-tight px-1.5 py-0.5 bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-bold rounded-md border border-brand-500/5">
                          {evt.time.split(' ')[0]} {evt.title}
                        </div>
                      ))}
                      {dayEvts.length > 2 && (
                        <div className="hidden sm:block text-[8px] text-muted-foreground font-semibold pl-1">
                          +{dayEvts.length - 2} {t("dashboardSchedule.moreClassesSuffix")}
                        </div>
                      )}
                      {/* Mobile summary dot */}
                      {hasEvents && (
                        <div className="sm:hidden mx-auto mt-1">
                          <div className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", isSelected ? "bg-white scale-110 shadow-sm" : "bg-brand-500 shadow-[0_0_8px_rgba(6,199,85,0.6)]")} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Daily Summary view */}
      <div className="lg:col-span-4 sticky top-28 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">
            {isSameDay(selectedDate, new Date()) ? t("dashboardSchedule.today") : `${selectedDate.getDate()} ${thaiMonths[selectedDate.getMonth()]}`}
          </h3>
          <Badge variant="secondary" className="font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/10">
            {selectedEvents.length} {t("dashboardSchedule.teachingItems")}
          </Badge>
        </div>

        <div className="space-y-4">
          {selectedEvents.length === 0 ? (
            <div className="border border-dashed border-border/60 rounded-3xl p-12 flex flex-col items-center justify-center text-center bg-card/40 backdrop-blur-sm animate-scale-in">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/10 flex items-center justify-center mb-4 animate-float">
                <CalendarDays className="h-6 w-6 text-brand-500" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">{t("dashboardSchedule.emptyDay")}</p>
            </div>
          ) : (
            selectedEvents.map((ev, idx) => (
              <Card key={ev.id} className="border border-border/40 hover:border-brand-500/30 hover:shadow-lg rounded-2xl relative overflow-hidden bg-card bg-gradient-to-br from-card via-card to-brand-500/2 dark:to-brand-500/5 transition-all duration-300">
                {/* Color accent strip */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand-400 to-brand-600" />
                <CardContent className="p-4 pl-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <Link href={`/dashboard/classes/${ev.classId}`} className="group flex-1 focus:outline-none">
                      <h4 className="font-bold text-foreground leading-tight group-hover:text-brand-500 transition-colors flex items-center gap-1.5">
                        {ev.title}
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-brand-500/70 shrink-0" />
                      </h4>
                    </Link>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 dark:bg-brand-500/20 w-fit px-2.5 py-1 rounded-lg border border-brand-500/5">
                      <Clock className="h-3.5 w-3.5" />
                      {ev.time}
                    </div>

                    <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground font-medium">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground/60" />
                        {ev.book}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground/60" />
                        {ev.students} {t("dashboardSchedule.peopleUnit")}
                      </div>
                    </div>

                    {/* Add to calendar buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                      <button
                        onClick={() => downloadICS(ev)}
                        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-muted hover:bg-brand-500/10 hover:text-brand-600 transition-colors"
                        title={t("dashboardSchedule.addToCalendarICS")}
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        {t("dashboardSchedule.addToCalendarICS")}
                      </button>
                      <a
                        href={googleCalUrl(ev)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-muted hover:bg-blue-500/10 hover:text-blue-600 transition-colors"
                        title={t("dashboardSchedule.addToCalendarGoogle")}
                      >
                        <CalendarPlus className="h-3.5 w-3.5" />
                        {t("dashboardSchedule.addToCalendarGoogle")}
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

/* Helper: local YYYY-MM-DD without UTC shift */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/*
  Helper: Smart parser from Thai schedule strings.
  Duplicated from shared logic or kept inline for performance isolation.
*/
function parseThaiSchedule(scheduleStr: string) {
  if (!scheduleStr || scheduleStr === t("dashboardSchedule.unsetSchedule")) {
    return { days: [1, 3, 5], timeRange: t("dashboardSchedule.byAppointment") };
  }

  const lowerStr = scheduleStr.toLowerCase();
  const dayMapping: { [key: string]: number } = {
    [t("tutorClass.days.sunFull")]: 0,
    [t("tutorClass.days.monFull")]: 1,
    [t("tutorClass.days.tueFull")]: 2,
    [t("tutorClass.days.wedFull")]: 3,
    [t("tutorClass.days.thuFull")]: 4,
    [t("dashboardSchedule.parserThuShort")]: 4,
    [t("tutorClass.days.friFull")]: 5,
    [t("tutorClass.days.satFull")]: 6,
  };

  const detectedDays: number[] = [];
  Object.entries(dayMapping).forEach(([name, val]) => {
    if (lowerStr.includes(name)) {
      if (!detectedDays.includes(val)) detectedDays.push(val);
    }
  });

  if (lowerStr.includes(t("tutorClass.scheduleEveryDayPrefix")) && detectedDays.length === 0) {
    return { days: [0, 1, 2, 3, 4, 5, 6], timeRange: extractTime(scheduleStr) };
  }

  const timeRange = extractTime(scheduleStr);
  if (detectedDays.length === 0) {
    return { days: [1, 3, 5], timeRange }; 
  }
  return { days: detectedDays, timeRange };
}

function extractTime(str: string) {
  const regex = /(\d{1,2}[:.]\d{2})\s*[\u002d\u2013]\s*(\d{1,2}[:.]\d{2})/;
  const match = str.match(regex);
  if (match) {
    return `${match[1].replace('.', ':')} - ${match[2].replace('.', ':')} ${t("tutorClass.scheduleSuffix")}`;
  }
  return t("dashboardSchedule.byAppointment");
}

/* ── ICS calendar helpers ─────────────────────────────────────────────────── */
const BY_DAY: Record<number, string> = { 0:"SU",1:"MO",2:"TU",3:"WE",4:"TH",5:"FR",6:"SA" };
const DAY_NAMES_MAP: Record<string, number> = {
  "จันทร์":1,"อังคาร":2,"พุธ":3,"พฤหัสบดี":4,"พฤหัส":4,"ศุกร์":5,"เสาร์":6,"อาทิตย์":0,
};

function parseDaysAndTime(schedStr: string) {
  const days: number[] = [];
  Object.entries(DAY_NAMES_MAP).forEach(([name, val]) => {
    if (schedStr.includes(name) && !days.includes(val)) days.push(val);
  });
  if (days.length === 0) days.push(1);
  const m = schedStr.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  return { days, sh:m?parseInt(m[1]):19, sm:m?parseInt(m[2]):0, eh:m?parseInt(m[3]):21, em:m?parseInt(m[4]):0 };
}

function buildICSContent(ev: ScheduledEvent & { startsAt?:string|null; endsAt?:string|null; schedule?:string }): string {
  const schedStr = ev.schedule || "";
  const { days, sh, sm, eh, em } = parseDaysAndTime(schedStr);
  const anchor = ev.startsAt ? new Date(ev.startsAt) : (ev.dateStr ? new Date(ev.dateStr) : new Date());
  const first = new Date(anchor); first.setHours(0,0,0,0);
  for (let i=0; i<7; i++) { if (days.includes(first.getDay())) break; first.setDate(first.getDate()+1); }
  const pad = (n:number) => String(n).padStart(2,"0");
  const fmt = (d:Date,h:number,mi:number) => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(h)}${pad(mi)}00`;
  const byday = days.map(d=>BY_DAY[d]).join(",");
  const until = ev.endsAt ? `;UNTIL=${new Date(ev.endsAt).toISOString().replace(/[-:.]/g,"").slice(0,15)}Z` : "";
  const dtstamp = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z";
  return [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Tutor Advantage//TH",
    "CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-TIMEZONE:Asia/Bangkok",
    "BEGIN:VEVENT",
    `UID:${ev.classId}-${Date.now()}@ta.th`,`DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=Asia/Bangkok:${fmt(first,sh,sm)}`,`DTEND;TZID=Asia/Bangkok:${fmt(first,eh,em)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byday}${until}`,
    `SUMMARY:${ev.title}`,`DESCRIPTION:${schedStr.replace(/\n/g,"\\n")}`,
    "BEGIN:VALARM","TRIGGER:-PT30M","ACTION:DISPLAY",`DESCRIPTION:แจ้งเตือน: ${ev.title}`,
    "END:VALARM","END:VEVENT","END:VCALENDAR",
  ].join("\r\n");
}

function downloadICS(ev: ScheduledEvent & { startsAt?:string|null; endsAt?:string|null; schedule?:string }) {
  const blob = new Blob([buildICSContent(ev)], { type:"text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=`${ev.title.replace(/\s+/g,"-")}.ics`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function googleCalUrl(ev: ScheduledEvent & { startsAt?:string|null; schedule?:string }): string {
  const schedStr = ev.schedule || "";
  const { days, sh, sm, eh, em } = parseDaysAndTime(schedStr);
  const anchor = ev.startsAt ? new Date(ev.startsAt) : (ev.dateStr ? new Date(ev.dateStr) : new Date());
  const pad = (n:number) => String(n).padStart(2,"0");
  const fmt = (d:Date,h:number,mi:number) => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(h)}${pad(mi)}00`;
  const byday = days.map(d=>BY_DAY[d]).join("%2C");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${fmt(anchor,sh,sm)}/${fmt(anchor,eh,em)}&recur=RRULE%3AFREQ%3DWEEKLY%3BBYDAY%3D${byday}&details=${encodeURIComponent(schedStr)}`;
}
