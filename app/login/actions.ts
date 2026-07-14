"use server";

import { redirect } from "next/navigation";
import { setSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export type LoginState = { error?: string };

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const expectedUser = process.env.APP_USERNAME;
  const passwordHash = process.env.APP_PASSWORD_HASH;

  if (!expectedUser || !passwordHash) {
    return { error: "Configura APP_USERNAME y APP_PASSWORD_HASH en el entorno." };
  }

  if (username !== expectedUser || !verifyPassword(password, passwordHash)) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  await setSession(username);
  redirect("/dashboard");
}
