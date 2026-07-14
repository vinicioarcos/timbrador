"use client";

import { useEffect, useMemo, useState } from "react";
import { MISSED_REMINDER_MINUTES, PRE_REMINDER_MINUTES, scheduleItems, todaySchedule, minutesOf } from "@/lib/schedule";
import type { ActiveSession, PunchRecord, ScheduleItem } from "@/lib/types";

const STORAGE_ACTIVE = "timbra.active";
const STORAGE_HISTORY = "timbra.history";
const dayLabels: Record<string, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
};

function hhmm(date = new Date()) {
  return date.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isoDate(date = new Date()) {
  return date.toLocaleDateString("en-CA");
}

export default function DashboardClient() {
  const [now, setNow] = useState(new Date());
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [history, setHistory] = useState<PunchRecord[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const savedActive = localStorage.getItem(STORAGE_ACTIVE);
    const savedHistory = localStorage.getItem(STORAGE_HISTORY);
    if (savedActive) setActive(JSON.parse(savedActive));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (active) localStorage.setItem(STORAGE_ACTIVE, JSON.stringify(active));
    else localStorage.removeItem(STORAGE_ACTIVE);
  }, [active]);

  useEffect(() => {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
  }, [history]);

  const today = useMemo(() => todaySchedule(now), [now]);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = today.filter((item) => minutesOf(item.end) >= currentMinutes).slice(0, 4);
  const due = today.find((item) => minutesOf(item.start) <= currentMinutes && currentMinutes < minutesOf(item.end)) ?? null;
  const next = today.find((item) => minutesOf(item.start) > currentMinutes) ?? null;
  const actionItem = due ?? next;

  const alert = useMemo(() => {
    if (active) {
      const end = minutesOf(active.scheduledEnd);
      const diff = end - currentMinutes;
      if (diff >= 0 && diff <= PRE_REMINDER_MINUTES) return { level: "warning", text: `En ${diff} min termina ${active.title}. Prepárate para timbrar salida.` };
      if (currentMinutes > end + MISSED_REMINDER_MINUTES) return { level: "urgent", text: `Falta la salida de ${active.title}. La sesión sigue activa.` };
    }

    if (!active && due && currentMinutes > minutesOf(due.start) + MISSED_REMINDER_MINUTES) {
      return { level: "urgent", text: `Falta la timbrada de ingreso de ${due.title}.` };
    }

    if (next) {
      const diff = minutesOf(next.start) - currentMinutes;
      if (diff >= 0 && diff <= PRE_REMINDER_MINUTES) {
        return active
          ? { level: "blocking", text: `En ${diff} min inicia ${next.title}. Primero debes cerrar ${active.title}.` }
          : { level: "warning", text: `En ${diff} min inicia ${next.title}. Prepárate para timbrar ingreso.` };
      }
    }
    return null;
  }, [active, due, next, currentMinutes]);

  function record(item: ScheduleItem, kind: "ENTRY" | "EXIT", scheduledTime: string) {
    const actual = hhmm();
    const status = minutesOf(actual) <= minutesOf(scheduledTime) + 1 ? "ON_TIME" : "LATE";
    setHistory((rows) => [{ id: uid(), scheduleItemId: item.id, title: item.title, kind, scheduledTime, actualTime: actual, actualDate: isoDate(), status }, ...rows]);
  }

  function clockIn(item: ScheduleItem) {
    if (active) {
      setNotice(`No puedes activar ${item.title}. Primero registra la salida de ${active.title}.`);
      return;
    }
    record(item, "ENTRY", item.start);
    setActive({ scheduleItemId: item.id, title: item.title, startedAt: hhmm(), scheduledEnd: item.end });
    setNotice(`Ingreso registrado: ${item.title}.`);
  }

  function clockOut() {
    if (!active) return;
    const item = scheduleItems.find((x) => x.id === active.scheduleItemId);
    if (!item) return;
    record(item, "EXIT", item.end);
    setActive(null);
    setNotice(`Salida registrada: ${item.title}.`);
  }

  async function requestNotifications() {
    if (!("Notification" in window)) {
      setNotice("Este navegador no admite notificaciones web.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotice(permission === "granted" ? "Notificaciones activadas en este dispositivo." : "No se concedió permiso para notificaciones.");
  }

  return (
    <>
      {alert ? <section className={`alert alert-${alert.level}`}>{alert.text}</section> : null}
      {notice ? <section className="toast" onClick={() => setNotice(null)}>{notice}</section> : null}

      <section className="hero-grid">
        <article className="status-card primary-card">
          <p className="eyebrow">AHORA · {hhmm(now)}</p>
          {active ? (
            <>
              <span className="status-pill live">ACTIVA</span>
              <h2>{active.title}</h2>
              <p>Ingreso real: {active.startedAt} · salida programada: {active.scheduledEnd}</p>
              <button className="danger-button" onClick={clockOut}>Timbrar salida</button>
            </>
          ) : (
            <>
              <span className="status-pill">SIN ACTIVIDAD ACTIVA</span>
              <h2>{due ? `Pendiente: ${due.title}` : actionItem ? `Próxima: ${actionItem.title}` : "No quedan actividades hoy"}</h2>
              <p>{actionItem ? `${actionItem.start}–${actionItem.end} · ${actionItem.type === "CLASS" ? "Clase" : "Gestión"}` : "Consulta la vista semanal para el siguiente día."}</p>
              {actionItem ? <button className="primary-button" onClick={() => clockIn(actionItem)}>Timbrar ingreso</button> : null}
            </>
          )}
        </article>

        <article className="status-card">
          <p className="eyebrow">RECORDATORIOS</p>
          <h2>T-3 y T+1</h2>
          <p>El prototipo comprueba el horario localmente. La arquitectura de producción usa push del servidor.</p>
          <button className="secondary-button" onClick={requestNotifications}>Activar notificaciones</button>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header"><div><p className="eyebrow">HOY</p><h2>Próximas horas</h2></div></div>
          <div className="timeline">
            {upcoming.length ? upcoming.map((item) => {
              const isActive = active?.scheduleItemId === item.id;
              return (
                <div className={`timeline-row ${isActive ? "timeline-active" : ""}`} key={item.id}>
                  <div className="time-range"><strong>{item.start}</strong><span>{item.end}</span></div>
                  <div>
                    <span className={`type-badge ${item.type.toLowerCase()}`}>{item.type === "CLASS" ? "Clase" : "Gestión"}</span>
                    <h3>{item.title}</h3>
                    {item.code ? <p>{item.code}</p> : null}
                  </div>
                  <button className="mini-button" disabled={Boolean(active) && !isActive} onClick={() => isActive ? clockOut() : clockIn(item)}>
                    {isActive ? "Salir" : "Ingresar"}
                  </button>
                </div>
              );
            }) : <p className="muted">No hay más actividades programadas para hoy.</p>}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header"><div><p className="eyebrow">AUDITORÍA</p><h2>Historial reciente</h2></div></div>
          <div className="history-list">
            {history.length ? history.slice(0, 10).map((row) => (
              <div className="history-row" key={row.id}>
                <div>
                  <strong>{row.kind === "ENTRY" ? "Ingreso" : "Salida"} · {row.actualTime}</strong>
                  <p>{row.title} · {row.actualDate === isoDate(now) ? "Hoy" : row.actualDate}</p>
                </div>
                <span className={`status-pill ${row.status === "LATE" ? "late" : "ok"}`}>{row.status === "LATE" ? "Tardía" : "A tiempo"}</span>
              </div>
            )) : <p className="muted">Todavía no hay timbradas registradas en este dispositivo.</p>}
          </div>
        </article>
      </section>

      <section className="panel weekly-panel">
        <div className="panel-header"><div><p className="eyebrow">SEMANA</p><h2>Horario completo</h2></div></div>
        <div className="week-grid">
          {Object.entries(dayLabels).map(([day, label]) => (
            <div className="day-column" key={day}>
              <h3>{label}</h3>
              {scheduleItems.filter((item) => item.day === day).map((item) => (
                <div className={`schedule-card ${item.type.toLowerCase()}`} key={item.id}>
                  <strong>{item.start}–{item.end}</strong>
                  <span>{item.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
