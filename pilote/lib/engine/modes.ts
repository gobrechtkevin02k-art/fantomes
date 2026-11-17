// Filtres et propositions propres aux modes Objectif cote et Jackpot.

import type { Reglages, Selection } from "../types";
import { proposerCombos, type PropositionCombo } from "./combos";

const heuresAvant = (s: Selection, maintenant: number) => (Date.parse(s.commence) - maintenant) / 3_600_000;

export function poolObjectif(selections: Selection[], r: Reglages, maintenant = Date.now(), cible?: number): Selection[] {
  const o = r.objectifCote;
  const coteMax = Math.min(o.coteJambeMax, cible ?? Infinity);
  return selections.filter((s) => {
    const h = heuresAvant(s, maintenant);
    return (
      r.marches.includes(s.market) &&
      !s.suspect &&
      s.odds >= 1.15 &&
      s.odds <= coteMax &&
      s.confidence >= o.confianceMin &&
      h > 0.25 &&
      h <= o.horizonJours * 24
    );
  });
}

export function combosObjectif(selections: Selection[], r: Reglages, cible: number, horizonJours: number, jambesMax: number, maintenant = Date.now()): PropositionCombo[] {
  const reglages: Reglages = { ...r, objectifCote: { ...r.objectifCote, horizonJours } };
  return proposerCombos(poolObjectif(selections, reglages, maintenant, cible), cible, jambesMax);
}

/** Grosses cotes simples : triées par valeur (les outsiders que Winamax paie mieux que le marché). */
export function simplesJackpot(selections: Selection[], r: Reglages, maintenant = Date.now(), limite = 12): Selection[] {
  return selections
    .filter((s) => {
      const h = heuresAvant(s, maintenant);
      return !s.suspect && s.odds >= r.jackpot.coteMin && h > 0.25 && h <= 14 * 24;
    })
    .sort((a, b) => b.edge - a.edge || b.confidence - a.confidence)
    .slice(0, limite);
}

/** Combinés à très grosse cote construits uniquement avec des sélections à espérance positive. */
export function combosJackpot(selections: Selection[], r: Reglages, maintenant = Date.now()): PropositionCombo[] {
  const pool = selections.filter((s) => {
    const h = heuresAvant(s, maintenant);
    return r.marches.includes(s.market) && !s.suspect && s.edge > 0 && s.confidence >= 50 && s.odds <= 8 && h > 0.25 && h <= 14 * 24;
  });
  return proposerCombos(pool, r.jackpot.cibleCombo, 12).slice(0, 3);
}
