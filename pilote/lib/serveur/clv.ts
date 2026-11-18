// Cote de clôture : juste avant le coup d'envoi, on relève la cote Winamax et le juste prix du marché
// pour chaque sélection jouée. Donnée de marché partagée entre tous les profils.

import "server-only";
import type { Cloture, MarketKey, Pari, SportEvent } from "../types";
import { probaMarche } from "../engine/direct";
import { lignesDuMarche } from "../engine/valeur";
import { stockage } from "./stockage";

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

/** Calcule la clôture d'une sélection à partir des cotes actuelles de son match. */
export function calculerCloture(ev: SportEvent, selectionId: string, maintenant: number): Cloture | null {
  const [, ligne, issue] = selectionId.split("|");
  if (!ligne || !issue) return null;
  const market = ligne.split(":")[0] as MarketKey;
  const point = ligne.includes(":") ? Number(ligne.split(":")[1]) : undefined;
  // Point de l'issue jouée (handicap : celui de l'équipe à l'extérieur est opposé à celui à domicile).
  const pointIssue = market === "spreads" && point !== undefined ? (issue === ev.home ? point : -point) : point;
  const jambe = { selectionId, eventId: ev.id, sportKey: ev.sportKey, sportTitle: ev.sportTitle, commence: ev.commence, home: ev.home, away: ev.away, market, issue, point: pointIssue, label: "", odds: 0, fairProb: 0, statut: "en_cours" as const };
  // Juste prix : consensus des bookmakers autres que Winamax.
  const sansWinamax = { ...ev, bookmakers: ev.bookmakers.filter((b) => b.key !== "winamax_fr") };
  const probaJuste = probaMarche(sansWinamax, jambe);
  if (probaJuste === null) return null;
  let cote: number | null = null;
  const wina = ev.bookmakers.find((b) => b.key === "winamax_fr");
  for (const m of wina?.markets ?? []) for (const l of lignesDuMarche(m, ev.home)) if (l.cle === ligne) cote = l.issues.find((i) => i.id === issue)?.price ?? cote;
  return { cote, probaJuste, releveLe: new Date(maintenant).toISOString() };
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
