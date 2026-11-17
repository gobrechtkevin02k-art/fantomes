// Les « skills » de l'analyste IA : des fiches d'expertise en Markdown (dossier skills/),
// chargées selon le sport du match et ajoutées à ses instructions.

import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

const cache = new Map<string, string>();

function lire(nom: string): string {
  const deja = cache.get(nom);
  if (deja !== undefined) return deja;
  let texte = "";
  try {
    texte = readFileSync(path.join(process.cwd(), "skills", nom, "SKILL.md"), "utf8").replace(/^---[\s\S]*?---\s*/, "").trim();
  } catch {
    texte = "";
  }
  cache.set(nom, texte);
  return texte;
}

const PAR_SPORT: Record<string, string> = { soccer: "football", basketball: "basket", tennis: "tennis" };

/** Méthode générale + fiche du sport (si elle existe). */
export function skillsPour(sport: string): string {
  const prefixe = sport.split("_")[0];
  return [lire("methode"), PAR_SPORT[prefixe] ? lire(PAR_SPORT[prefixe]) : ""].filter(Boolean).join("\n\n");
}
