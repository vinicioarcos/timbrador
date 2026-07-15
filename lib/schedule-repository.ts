import { query } from "@/lib/db";
import type { ActivityType, ScheduleItem, WeekDay } from "@/lib/types";

const dayNumberByName: Record<WeekDay, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
};

const dayNameByNumber: Record<number, WeekDay> = {
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
};

type ScheduleItemRow = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  activity_type: ActivityType;
  title: string;
  course_code: string | null;
};

function hhmm(pgTime: string): string {
  return pgTime.slice(0, 5);
}

function mapRow(row: ScheduleItemRow): ScheduleItem {
  return {
    id: row.id,
    day: dayNameByNumber[row.day_of_week],
    start: hhmm(row.start_time),
    end: hhmm(row.end_time),
    type: row.activity_type,
    title: row.title,
    code: row.course_code ?? undefined,
  };
}

export async function listScheduleItems(userId: string, options?: { includeInactive?: boolean }): Promise<ScheduleItem[]> {
  const result = options?.includeInactive
    ? await query<ScheduleItemRow>(
        `select si.id, si.day_of_week, si.start_time, si.end_time, si.activity_type, si.title, si.course_code
         from schedule_items si
         join users u on u.id = si.user_id
         where u.username = $1
         order by si.day_of_week, si.start_time`,
        [userId],
      )
    : await query<ScheduleItemRow>(
        `select si.id, si.day_of_week, si.start_time, si.end_time, si.activity_type, si.title, si.course_code
         from schedule_items si
         join users u on u.id = si.user_id
         where u.username = $1 and si.active = true
         order by si.day_of_week, si.start_time`,
        [userId],
      );
  return result.rows.map(mapRow);
}

export async function createScheduleItem(userId: string, item: ScheduleItem): Promise<ScheduleItem> {
  const result = await query<ScheduleItemRow>(
    `insert into schedule_items (id, user_id, day_of_week, start_time, end_time, activity_type, title, course_code, active)
     select $1, u.id, $2, $3, $4, $5, $6, $7, true
     from users u where u.username = $8
     returning id, day_of_week, start_time, end_time, activity_type, title, course_code`,
    [item.id, dayNumberByName[item.day], item.start, item.end, item.type, item.title, item.code ?? null, userId],
  );
  if (result.rows.length === 0) throw new Error(`Usuario '${userId}' no existe.`);
  return mapRow(result.rows[0]);
}

export async function updateScheduleItem(
  userId: string,
  id: string,
  patch: Partial<Pick<ScheduleItem, "day" | "start" | "end" | "type" | "title" | "code">>,
): Promise<ScheduleItem | null> {
  const result = await query<ScheduleItemRow>(
    `update schedule_items si
     set day_of_week = coalesce($3, si.day_of_week),
         start_time = coalesce($4, si.start_time),
         end_time = coalesce($5, si.end_time),
         activity_type = coalesce($6, si.activity_type),
         title = coalesce($7, si.title),
         course_code = coalesce($8, si.course_code)
     from users u
     where si.user_id = u.id and u.username = $1 and si.id = $2
     returning si.id, si.day_of_week, si.start_time, si.end_time, si.activity_type, si.title, si.course_code`,
    [
      userId,
      id,
      patch.day ? dayNumberByName[patch.day] : null,
      patch.start ?? null,
      patch.end ?? null,
      patch.type ?? null,
      patch.title ?? null,
      patch.code ?? null,
    ],
  );
  return result.rows.length ? mapRow(result.rows[0]) : null;
}

// Baja lógica: nunca se borra un bloque de horario, porque session_instances y
// punch_events referencian schedule_items.id y BR-010 exige auditoría completa.
export async function deactivateScheduleItem(userId: string, id: string): Promise<boolean> {
  const result = await query(
    `update schedule_items si
     set active = false
     from users u
     where si.user_id = u.id and u.username = $1 and si.id = $2`,
    [userId, id],
  );
  return (result.rowCount ?? 0) > 0;
}
