export type WeekDay = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY";
export type ActivityType = "CLASS" | "MANAGEMENT";

export type ScheduleItem = {
  id: string;
  day: WeekDay;
  start: string;
  end: string;
  type: ActivityType;
  title: string;
  code?: string;
};

export type PunchRecord = {
  id: string;
  scheduleItemId: string;
  title: string;
  kind: "ENTRY" | "EXIT";
  scheduledTime: string;
  actualTime: string;
  originalTime: string;
  actualDate: string;
  status: "ON_TIME" | "LATE";
  correction?: { reason: string; correctedBy: string; correctedAt: string };
};

export type ActiveSession = {
  scheduleItemId: string;
  title: string;
  startedAt: string;
  scheduledEnd: string;
};
