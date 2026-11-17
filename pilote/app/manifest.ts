import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pilote — paris sportifs",
    short_name: "Pilote",
    description: "Indice de confiance, mise automatique et suivi de bankroll pour tes paris Winamax.",
    start_url: "/",
    display: "standalone",
    background_color: "#090c11",
    theme_color: "#090c11",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
