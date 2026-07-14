import seed from "@/data/schedule.seed.json";
import type { ScheduleItem, WeekDay } from "@/lib/types";

export const TIMEZONE = seed.meta.timezone;
export const PRE_REMINDER_MINUTES = seed.meta.rules.preReminderMinutes;
export const MISSED_REMINDER_MINUTES = seed.meta.rules.missedReminderMinutes;
export const scheduleItems = seed.items as ScheduleItem[];

const weekdayNameMap: Record<string, WeekDay | null> = {
  Mon: "MONDAY",
  Tue: "TUESDAY",
  Wed: "WEDNESDAY",
  Thu: "THURSDAY",
  Fri: "FRIDAY",
  Sat: null,
  Sun: null,
};

const guayaquilPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Deriva día/hora/minuto en America/Guayaquil a partir de un Date en cualquier
// zona horaria del proceso (necesario porque Vercel corre en UTC, no en Guayaquil).
function guayaquilParts(date: Date): { weekDay: WeekDay | null; hour: number; minute: number } {
  const map: Record<string, string> = {};
  for (const part of guayaquilPartsFormatter.formatToParts(date)) {
    map[part.type] = part.value;
  }
  return {
    weekDay: weekdayNameMap[map.weekday] ?? null,
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
  };
}

export function currentWeekDay(date = new Date()): WeekDay | null {
  return guayaquilParts(date).weekDay;
}

export function todaySchedule(date = new Date()): ScheduleItem[] {
  const day = currentWeekDay(date);
  if (!day) return [];
  return scheduleItems.filter((item) => item.day === day).sort((a, b) => a.start.localeCompare(b.start));
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function nowMinutes(date = new Date()): number {
  const { hour, minute } = guayaquilParts(date);
  return hour * 60 + minute;
}

const guayaquilDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function guayaquilDateString(date = new Date()): string {
  return guayaquilDateFormatter.format(date);
}

export function nextItem(date = new Date()): ScheduleItem | null {
  const now = nowMinutes(date);
  return todaySchedule(date).find((item) => minutesOf(item.start) >= now) ?? null;
}

export function itemForNow(date = new Date()): ScheduleItem | null {
  const now = nowMinutes(date);
  return todaySchedule(date).find((item) => minutesOf(item.start) <= now && now < minutesOf(item.end)) ?? null;
}
