import { requireSession } from "@/lib/auth";
import DashboardClient from "./dashboard-client";
import { logout } from "./actions";

export default async function DashboardPage() {
  await requireSession();

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
      <DashboardClient />
    </main>
  );
}
