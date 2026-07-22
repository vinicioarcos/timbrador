"use client";

import { useMemo, useState, useEffect } from "react";
import { MISSED_REMINDER_MINUTES, PRE_REMINDER_MINUTES, guayaquilDateString, guayaquilTimestamp, scheduleItems, todaySchedule, minutesOf } from "@/lib/schedule";
import { toActiveSessionView, toPunchRecordView } from "@/lib/dashboard-view";
import type { ActiveSession, PunchRecord, ScheduleItem } from "@/lib/types";
import { clockInAction, clockOutAction, correctPunchAction } from "./actions";

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

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

type Props = {
  initialActive: ActiveSession | null;
  initialHistory: PunchRecord[];
};

export default function DashboardClient({ initialActive, initialHistory }: Props) {
  const [now, setNow] = useState(new Date());
  const [active, setActive] = useState<ActiveSession | null>(initialActive);
  const [history, setHistory] = useState<PunchRecord[]>(initialHistory);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctionTime, setCorrectionTime] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionPending, setCorrectionPending] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

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

  async function clockIn(item: ScheduleItem) {
    if (pending) return;
    if (active) {
      setNotice(`No puedes activar ${item.title}. Primero registra la salida de ${active.title}.`);
      return;
    }
    setPending(true);
    try {
      const result = await clockInAction(item.id, crypto.randomUUID());
      if (!result.ok) {
        setNotice(result.reason);
        return;
      }
      setActive(toActiveSessionView(result.session, item));
      setHistory((rows) => [toPunchRecordView(result.audit, item), ...rows]);
      setNotice(`Ingreso registrado: ${item.title}.`);
    } catch {
      setNotice("No se pudo registrar el ingreso. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  async function clockOut() {
    if (pending || !active) return;
    const item = scheduleItems.find((x) => x.id === active.scheduleItemId);
    if (!item) return;
    setPending(true);
    try {
      const result = await clockOutAction(active.scheduleItemId, crypto.randomUUID());
      if (!result.ok) {
        setNotice(result.reason);
        return;
      }
      setHistory((rows) => [toPunchRecordView(result.audit, item), ...rows]);
      setActive(null);
      setNotice(`Salida registrada: ${item.title}.`);
    } catch {
      setNotice("No se pudo registrar la salida. Intenta de nuevo.");
    } finally {
      setPending(false);
    }
  }

  function startCorrection(row: PunchRecord) {
    setCorrectingId(row.id);
    setCorrectionTime(row.actualTime);
    setCorrectionReason("");
  }

  function cancelCorrection() {
    setCorrectingId(null);
    setCorrectionTime("");
    setCorrectionReason("");
  }

  // T-016: corrige la hora efectiva de una timbrada ya registrada (nunca la
  // edita en el servidor — inserta una corrección aparte, ver
  // lib/punch-store.ts createPunchCorrection). La puntualidad se recalcula
  // localmente igual que en toPunchRecordView, contra la hora corregida.
  async function submitCorrection(row: PunchRecord) {
    if (correctionPending) return;
    if (!correctionTime || !correctionReason.trim()) {
      setNotice("Completa la hora y el motivo de la corrección.");
      return;
    }
    setCorrectionPending(true);
    try {
      const correctedAt = guayaquilTimestamp(row.actualDate, correctionTime);
      const result = await correctPunchAction(row.id, correctedAt, correctionReason.trim());
      if (!result.ok) {
        setNotice(result.reason);
        return;
      }
      const status: PunchRecord["status"] =
        row.scheduledTime && minutesOf(correctionTime) <= minutesOf(row.scheduledTime) + 1 ? "ON_TIME" : "LATE";
      setHistory((rows) =>
        rows.map((r) =>
          r.id === row.id
            ? { ...r, actualTime: correctionTime, status, correction: { reason: result.correction.reason, correctedBy: result.correction.correctedBy, correctedAt: result.correction.correctedAt } }
            : r,
        ),
      );
      setNotice("Corrección registrada.");
      cancelCorrection();
    } catch {
      setNotice("No se pudo registrar la corrección. Intenta de nuevo.");
    } finally {
      setCorrectionPending(false);
    }
  }

  async function requestNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotice("Este navegador no admite notificaciones push.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNotice("No se concedió permiso para notificaciones.");
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setNotice("Falta configurar la llave pública de notificaciones (NEXT_PUBLIC_VAPID_PUBLIC_KEY).");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      setNotice("Notificaciones activadas en este dispositivo.");
    } catch {
      setNotice("No se pudo activar la suscripción de notificaciones.");
    }
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
              <button className="danger-button" onClick={clockOut} disabled={pending}>Timbrar salida</button>
            </>
          ) : (
            <>
              <span className="status-pill">SIN ACTIVIDAD ACTIVA</span>
              <h2>{due ? `Pendiente: ${due.title}` : actionItem ? `Próxima: ${actionItem.title}` : "No quedan actividades hoy"}</h2>
              <p>{actionItem ? `${actionItem.start}–${actionItem.end} · ${actionItem.type === "CLASS" ? "Clase" : "Gestión"}` : "Consulta la vista semanal para el siguiente día."}</p>
              {actionItem ? <button className="primary-button" onClick={() => clockIn(actionItem)} disabled={pending}>Timbrar ingreso</button> : null}
            </>
          )}
        </article>

        <article className="status-card">
          <p className="eyebrow">RECORDATORIOS</p>
          <h2>T-3 y T+1</h2>
          <p>Los recordatorios de producción los envía el servidor (Web Push), no este dispositivo. Este panel activa la suscripción.</p>
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
                  <button className="mini-button" disabled={pending || (Boolean(active) && !isActive)} onClick={() => isActive ? clockOut() : clockIn(item)}>
                    {isActive ? "Salir" : "Ingresar"}
                  </button>
                </div>
              );
            }) : <p className="muted">No hay más actividades programadas para hoy.</p>}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header"><div><p className="eyebrow">AUDITORÍA</p><h2>Historial de hoy</h2></div></div>
          <div className="history-list">
            {history.length ? history.slice(0, 10).map((row) => (
              <div className="history-row" key={row.id}>
                <div>
                  <strong>{row.kind === "ENTRY" ? "Ingreso" : "Salida"} · {row.actualTime}</strong>
                  <p>{row.title} · {row.actualDate === guayaquilDateString(now) ? "Hoy" : row.actualDate}</p>
                  {row.correction ? (
                    <p className="correction-note">Corregido (original {row.originalTime}) · {row.correction.reason}</p>
                  ) : correctingId === row.id ? (
                    <div className="correction-form">
                      <input type="time" value={correctionTime} onChange={(e) => setCorrectionTime(e.target.value)} disabled={correctionPending} />
                      <input type="text" placeholder="Motivo de la corrección" value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} disabled={correctionPending} />
                      <button className="mini-button" onClick={() => submitCorrection(row)} disabled={correctionPending}>Guardar</button>
                      <button className="mini-button" onClick={cancelCorrection} disabled={correctionPending}>Cancelar</button>
                    </div>
                  ) : (
                    <button className="mini-button" onClick={() => startCorrection(row)}>Corregir hora</button>
                  )}
                </div>
                <span className={`status-pill ${row.status === "LATE" ? "late" : "ok"}`}>{row.status === "LATE" ? "Tardía" : "A tiempo"}</span>
              </div>
            )) : <p className="muted">Todavía no hay timbradas registradas hoy.</p>}
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
