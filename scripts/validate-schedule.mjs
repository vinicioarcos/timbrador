import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(new URL("../data/schedule.seed.json", import.meta.url), "utf8"));
const allowedDays = new Set(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]);
const allowedTypes = new Set(["CLASS", "MANAGEMENT"]);
const errors = [];

function minutes(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

for (const item of data.items) {
  if (!item.id) errors.push("Item sin id");
  if (!allowedDays.has(item.day)) errors.push(`${item.id}: día no permitido ${item.day}`);
  if (!allowedTypes.has(item.type)) errors.push(`${item.id}: tipo no permitido ${item.type}`);
  const start = minutes(item.start);
  const end = minutes(item.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) errors.push(`${item.id}: rango horario inválido`);
}

for (const day of allowedDays) {
  const items = data.items.filter((x) => x.day === day).sort((a,b) => a.start.localeCompare(b.start));
  for (let i = 1; i < items.length; i++) {
    if (minutes(items[i].start) < minutes(items[i-1].end)) {
      errors.push(`${day}: solapamiento entre ${items[i-1].id} y ${items[i].id}`);
    }
  }
}

if (errors.length) {
  console.error("Horario inválido:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(`Horario válido: ${data.items.length} bloques, lunes a viernes, sin solapamientos.`);
