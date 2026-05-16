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
  ExternalLink 
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
      
      const loopDate = new Date(startDate);
      while (loopDate <= endDate) {
        if (days.includes(loopDate.getDay())) {
          const dStr = loopDate.toISOString().split('T')[0];
          events.push({
            id: `${cls.id}-${dStr}`,
            classId: cls.id,
            title: cls.name,
            book: cls.book,
            students: cls.students,
            time: timeRange,
            dateStr: dStr,
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
    const dStr = d.toISOString().split('T')[0];
    return allEvents.filter(ev => ev.dateStr === dStr);
  };

  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const selectedEvents = useMemo(() => 
    allEvents.filter(ev => ev.dateStr === selectedDateStr).sort((a, b) => a.time.localeCompare(b.time)),
    [allEvents, selectedDateStr]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* Left Column: Monthly Calendar View */}
      <div className="lg:col-span-7">
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {thaiMonths[currentDate.getMonth()]} {currentDate.getFullYear() + 543}
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Week Header */}
            <div className="grid grid-cols-7 mb-2">
              {daysOfWeek.map((dw, idx) => (
                <div key={idx} className={cn("text-center text-xs font-medium py-2 text-muted-foreground", 
                  (idx === 0 || idx === 6) && "text-muted-foreground/60")}>
                  {dw}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
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
                      "relative group min-h-[70px] sm:min-h-[90px] border rounded-xl transition-all flex flex-col items-start p-2 focus:outline-none",
                      isSelected 
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm z-10" 
                        : "border-transparent hover:border-muted-foreground/20 hover:bg-muted/50 bg-muted/20",
                      isInactive && "opacity-40"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-semibold flex items-center justify-center w-6 h-6 rounded-full transition-colors mb-1",
                      isToday && !isSelected && "bg-primary text-primary-foreground",
                      isSelected && "bg-primary text-primary-foreground",
                      !isToday && !isSelected && "text-foreground"
                    )}>
                      {dayObj.day}
                    </span>
                    
                    {/* Tiny dots or summaries on desktop view inside the cell */}
                    <div className="w-full flex flex-col gap-0.5 overflow-hidden mt-auto">
                      {dayEvts.slice(0, 3).map((evt, idx) => (
                        <div key={idx} className="hidden sm:block text-[9px] truncate leading-tight px-1 py-0.5 bg-primary/10 dark:bg-primary/20 text-primary font-medium rounded-sm">
                          {evt.time.split(' ')[0]} {evt.title}
                        </div>
                      ))}
                      {dayEvts.length > 3 && (
                        <div className="hidden sm:block text-[8px] text-muted-foreground pl-1">
                          +{dayEvts.length - 3} {t("dashboardSchedule.moreClassesSuffix")}
                        </div>
                      )}
                      {/* Mobile summary dot */}
                      {hasEvents && (
                        <div className="sm:hidden mx-auto">
                          <div className={cn("w-1.5 h-1.5 rounded-full", isSelected ? "bg-primary" : "bg-primary/70")} />
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
      <div className="lg:col-span-5 sticky top-24">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">
            {isSameDay(selectedDate, new Date()) ? t("dashboardSchedule.today") : `${selectedDate.getDate()} ${thaiMonths[selectedDate.getMonth()]}`}
          </h3>
          <Badge variant="secondary" className="font-medium">
            {selectedEvents.length} {t("dashboardSchedule.teachingItems")}
          </Badge>
        </div>

        <div className="space-y-3">
          {selectedEvents.length === 0 ? (
            <div className="border rounded-xl border-dashed p-12 flex flex-col items-center justify-center text-center bg-card/50">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{t("dashboardSchedule.emptyDay")}</p>
            </div>
          ) : (
            selectedEvents.map((ev, idx) => (
              <Link key={ev.id} href={`/dashboard/classes/${ev.classId}`} className="group block">
                <Card className="transition-all hover:shadow-md hover:border-primary/30 cursor-pointer relative overflow-hidden group">
                  {/* Color accent strip */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40 group-hover:bg-primary transition-colors" />
                  <CardContent className="p-4 pl-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
                        {ev.title}
                      </h4>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 dark:bg-primary/20 w-fit px-2 py-1 rounded-md">
                        <Clock className="h-3.5 w-3.5" />
                        {ev.time}
                      </div>
                      
                      <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5 text-muted-foreground/60" />
                          {ev.book}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground/60" />
                          {ev.students} {t("dashboardSchedule.peopleUnit")}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>

    </div>
  );
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
