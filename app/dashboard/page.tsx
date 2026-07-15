import { getSessionUsername, requireSession } from "@/lib/auth";
import { toActiveSessionView, toPunchRecordView } from "@/lib/dashboard-view";
import { findActiveSession, listAudit } from "@/lib/punch-store";
import { guayaquilDateString, scheduleItems } from "@/lib/schedule";
import DashboardClient from "./dashboard-client";
import { logout } from "./actions";

export default async function DashboardPage() {
  await requireSession();
  const username = await getSessionUsername();
  if (!username) {
    // requireSession() ya garantiza una cookie válida; esto es una red de
    // seguridad defensiva, no debería ocurrir en la práctica.
    throw new Error("No se pudo determinar el usuario autenticado.");
  }

  const [activeSession, todayAudit] = await Promise.all([
    findActiveSession(username),
    listAudit(username, { date: guayaquilDateString(new Date()) }),
  ]);

  const activeItem = activeSession ? scheduleItems.find((item) => item.id === activeSession.scheduleItemId) : undefined;
  const initialActive = activeSession && activeItem ? toActiveSessionView(activeSession, activeItem) : null;
  const initialHistory = todayAudit
    .filter((audit) => audit.result === "SUCCESS")
    .map((audit) => toPunchRecordView(audit, scheduleItems.find((item) => item.id === audit.scheduleItemId)));

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Timbra Académica</p>
          <h1>Panel del horario</h1>
        </div>
        <form action={logout}>
          <button className="ghost-button">Cerrar sesión</button>
        </form>
      </header>
      <DashboardClient initialActive={initialActive} initialHistory={initialHistory} />
    </main>
  );
}
