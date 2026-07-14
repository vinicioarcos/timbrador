"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="login-card">
      <div className="brand-mark">TA</div>
      <p className="eyebrow">CONTROL ACADÉMICO</p>
      <h1>Timbra Académica</h1>
      <p className="muted">Ingresa para consultar tu horario y controlar las timbradas del día.</p>
      <label>
        Usuario
        <input name="username" autoComplete="username" required />
      </label>
      <label>
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button className="primary-button" disabled={pending}>{pending ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
