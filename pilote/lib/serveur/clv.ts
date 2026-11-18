// Cote de clôture : juste avant le coup d'envoi, on relève la cote Winamax et le juste prix du marché
// pour chaque sélection jouée. Donnée de marché partagée entre tous les profils.

import "server-only";
import type { Cloture, Pari } from "../types";
import { stockage } from "./stockage";

export { calculerCloture } from "../engine/cloture";

const cle = (selectionId: string) => `cloture:${selectionId}`;

/** Sélections à relever : matchs qui commencent dans les 20 prochaines minutes, sans cote de clôture. */
export async function aRelever(paris: Pari[], maintenant: number): Promise<{ selectionId: string; eventId: string; sportKey: string }[]> {
  const out = new Map<string, { selectionId: string; eventId: string; sportKey: string }>();
  for (const p of paris) {
    if (p.statut !== "en_cours" || p.demo) continue;
    for (const j of p.jambes) {
      const t = Date.parse(j.commence);
      if (t > maintenant && t - maintenant <= 20 * 60_000 && !out.has(j.selectionId)) out.set(j.selectionId, { selectionId: j.selectionId, eventId: j.eventId, sportKey: j.sportKey });
    }
  }
  const restantes = [];
  for (const s of out.values()) if (!(await stockage().get<Cloture>(cle(s.selectionId)))) restantes.push(s);
  return restantes;
}

export async function enregistrerCloture(selectionId: string, c: Cloture) {
  await stockage().set(cle(selectionId), c, 180 * 86_400);
}

export async function cloturesPour(selectionIds: string[]): Promise<Record<string, Cloture>> {
  const out: Record<string, Cloture> = {};
  await Promise.all(
    [...new Set(selectionIds)].slice(0, 2000).map(async (id) => {
      const c = await stockage().get<Cloture>(cle(id)).catch(() => null);
      if (c) out[id] = c;
    }),
  );
  return out;
}
