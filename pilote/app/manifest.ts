import type { MetadataRoute } from "next";

// Manifeste de l'appli installée (Android, iPhone, ordinateur) : icônes, raccourcis, captures pour la fiche d'installation.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pilote — paris sportifs",
    short_name: "Pilote",
    description: "Indice de confiance, mise automatique et suivi de bankroll pour tes paris Winamax.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#090c11",
    theme_color: "#090c11",
    lang: "fr",
    dir: "ltr",
    categories: ["sports", "finance"],
    launch_handler: { client_mode: "navigate-existing" },
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Plan du jour", short_name: "Plan", url: "/", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
      { name: "Classique", url: "/classique", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
      { name: "Suivi de bankroll", short_name: "Suivi", url: "/suivi", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
      { name: "Résultats", url: "/resultats", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
    ],
    screenshots: [
      { src: "/icones/capture-plan.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Le plan du jour du conseiller" },
      { src: "/icones/capture-classique.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Les paris Classique et leur indice de confiance" },
      { src: "/icones/capture-objectif.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Objectif cote : le meilleur combiné pour ta cote" },
    ],
  };
}
