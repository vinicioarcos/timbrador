import fs from "node:fs";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL no está configurado.");
  process.exit(1);
}

const schemaSql = fs.readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const scheduleSeed = JSON.parse(fs.readFileSync(new URL("../data/schedule.seed.json", import.meta.url), "utf8"));

const dayNumber = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5 };

async function main() {
  const pool = new Pool({ connectionString });

  await pool.query(schemaSql);
  console.log("Esquema aplicado (db/schema.sql).");

  const username = process.env.APP_USERNAME;
  const passwordHash = process.env.APP_PASSWORD_HASH;
  if (!username || !passwordHash) {
    console.warn("APP_USERNAME/APP_PASSWORD_HASH no configurados: se omite la siembra de usuario y horario.");
    await pool.end();
    return;
  }

  const userResult = await pool.query(
    `insert into users (username, password_hash, timezone)
     values ($1, $2, $3)
     on conflict (username) do update set password_hash = excluded.password_hash
     returning id`,
    [username, passwordHash, scheduleSeed.meta.timezone],
  );
  const userId = userResult.rows[0].id;
  console.log(`Usuario '${username}' listo (id=${userId}).`);

  for (const item of scheduleSeed.items) {
    await pool.query(
      `insert into schedule_items (id, user_id, day_of_week, start_time, end_time, activity_type, title, course_code, active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, true)
       on conflict (id) do update set
         user_id = excluded.user_id,
         day_of_week = excluded.day_of_week,
         start_time = excluded.start_time,
         end_time = excluded.end_time,
         activity_type = excluded.activity_type,
         title = excluded.title,
         course_code = excluded.course_code,
         active = true`,
      [item.id, userId, dayNumber[item.day], item.start, item.end, item.type, item.title, item.code ?? null],
    );
  }
  console.log(`Horario sembrado: ${scheduleSeed.items.length} bloques.`);

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
