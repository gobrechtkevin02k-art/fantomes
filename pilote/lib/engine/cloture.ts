// Cote de clôture d'une sélection : cote Winamax et juste prix (consensus des autres bookmakers)
// à partir des cotes d'un match juste avant le coup d'envoi.

import type { Cloture, MarketKey, SportEvent } from "../types";
import { probaMarche } from "./direct";
import { lignesDuMarche } from "./valeur";

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
