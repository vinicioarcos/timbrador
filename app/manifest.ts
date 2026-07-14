import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Timbra Académica",
    short_name: "Timbra",
    description: "Recordatorios y control de timbradas académicas",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#07111f",
    theme_color: "#0b6cff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" }
    ]
  };
}
