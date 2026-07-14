import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Timbra Académica",
  description: "Recordatorios y control de timbradas académicas",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
