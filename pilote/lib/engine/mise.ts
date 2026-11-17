// Calcul automatique des mises : critère de Kelly fractionné, modulé par l'indice de confiance,
// plafonné par le profil de risque, la poche du mode et les garde-fous.

import type { Mode, Pari, Profil, Reglages, Selection } from "../types";
import type { Protections } from "./bankroll";
import { clamp } from "./proba";
import { probaAjustee } from "./valeur";

export const FRACTION_KELLY: Record<Profil, number> = { prudent: 0.15, equilibre: 0.25, offensif: 0.35 };
export const MISE_MAX_PCT: Record<Profil, number> = { prudent: 0.02, equilibre: 0.03, offensif: 0.05 };
export const LIBELLE_PROFIL: Record<Profil, string> = { prudent: "Prudent", equilibre: "Équilibré", offensif: "Offensif" };

export interface ContexteMise {
  reglages: Reglages;
  poches: Record<Mode, number>;
  total: number;
  protections: Protections;
}

export interface ResultatMise {
  mise: number;
  pctBankroll: number;
  explication: string;
  bloque: boolean;
}

/** Fraction de Kelly : part de la bankroll qui maximise la croissance à long terme. */
export function kelly(p: number, cote: number): number {
  if (cote <= 1) return 0;
  return Math.max(0, (p * cote - 1) / (cote - 1));
}

export function arrondir(x: number, pas: number): number {
  if (!(x > 0)) return 0;
  const n = Math.floor(x / pas + 1e-9) * pas;
  return Math.round(n * 100) / 100;
}

const eur = (x: number) => x.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const pct = (x: number, d = 1) => `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: d })} %`;

function bloque(ctx: ContexteMise): ResultatMise | null {
  if (ctx.protections.bloque) return { mise: 0, pctBankroll: 0, explication: ctx.protections.raisons.join(" "), bloque: true };
  return null;
}

function finaliser(brute: number, ctx: ContexteMise, mode: Mode, explication: string, plancherMin = false): ResultatMise {
  const { miseMin, arrondi } = ctx.reglages;
  const poche = Math.max(0, ctx.poches[mode]);
  let mise = arrondir(Math.min(brute, poche), arrondi);
  if (mise < miseMin) {
    if (plancherMin && poche >= miseMin) mise = miseMin;
    else
      return {
        mise: 0,
        pctBankroll: 0,
        explication: poche < miseMin ? "Poche vide : rééquilibre ou recharge ta bankroll." : "Avantage trop faible pour justifier une mise.",
        bloque: false,
      };
  }
  return { mise, pctBankroll: ctx.total > 0 ? mise / ctx.total : 0, explication, bloque: false };
}

/** Mode Classique : Kelly fractionné sur la probabilité ajustée par la confiance. */
export function miseClassique(sel: Selection, ctx: ContexteMise): ResultatMise {
  const b = bloque(ctx);
  if (b) return b;
  const { profil } = ctx.reglages;
  const prudence = ctx.protections.prudence ? 0.5 : 1;
  const p = probaAjustee(sel);
  const k = kelly(p, sel.odds);
  const frac = FRACTION_KELLY[profil] * prudence;
  const poche = Math.max(0, ctx.poches.classique);
  const plafond = ctx.total * MISE_MAX_PCT[profil] * prudence;
  const brute = Math.min(poche * frac * k, plafond);
  const plafonne = poche * frac * k > plafond;
  const explication =
    `Kelly ${pct(k)} × ${frac.toLocaleString("fr-FR")} (profil ${LIBELLE_PROFIL[profil].toLowerCase()}${prudence < 1 ? ", mode prudence" : ""}) × poche ${eur(poche)}` +
    (plafonne ? ` → plafonné à ${pct(MISE_MAX_PCT[profil] * prudence)} de la bankroll` : "");
  return finaliser(brute, ctx, "classique", explication);
}

/** Mode Objectif cote : de 1 % de la poche (confiance ≤ 40) à 5 % (confiance ≥ 90), plafonné à 2 % de la bankroll. */
export function miseObjectif(confiance: number, ctx: ContexteMise): ResultatMise {
  const b = bloque(ctx);
  if (b) return b;
  const prudence = ctx.protections.prudence ? 0.5 : 1;
  const part = 0.01 + 0.04 * clamp((confiance - 40) / 50, 0, 1);
  const poche = Math.max(0, ctx.poches.objectif);
  const plafond = ctx.total * 0.02 * prudence;
  const brute = Math.min(poche * part * prudence, plafond);
  return finaliser(brute, ctx, "objectif", `${pct(part)} de la poche Objectif (${eur(poche)}) selon l'indice ${Math.round(confiance)}${prudence < 1 ? ", divisé par 2 (mode prudence)" : ""}`, true);
}

/** Mode Jackpot : petite mise fixe (réglable) modulée par la confiance, jamais plus de 0,5 % de la bankroll. */
export function miseJackpot(confiance: number, ctx: ContexteMise): ResultatMise {
  const b = bloque(ctx);
  if (b) return b;
  const base = ctx.reglages.jackpot.misePct / 100;
  const part = base * (0.5 + clamp(confiance, 0, 100) / 100);
  const poche = Math.max(0, ctx.poches.jackpot);
  const plafond = ctx.total * 0.005;
  const brute = Math.min(poche * part, plafond);
  return finaliser(brute, ctx, "jackpot", `${pct(part)} de la poche Jackpot (${eur(poche)}), plafonné à 0,5 % de la bankroll`, true);
}

// ---------------------------------------------------------------------------
// Plan du jour (mode Classique)

export interface Recommandation {
  selection: Selection;
  mise: ResultatMise;
  gainAttendu: number; // mise × espérance
  horsBudget: boolean; // dépasse l'exposition maximale restante
  dejaJoue: boolean;
}

export function filtreClassique(s: Selection, r: Reglages, maintenant = Date.now(), horizonJours = 7): boolean {
  const c = r.classique;
  const h = (Date.parse(s.commence) - maintenant) / 3_600_000;
  return (
    r.marches.includes(s.market) &&
    !s.suspect &&
    s.odds >= c.coteMin &&
    s.odds <= c.coteMax &&
    s.edge >= c.edgeMin &&
    s.confidence >= c.confianceMin &&
    h > 0.1 &&
    h <= horizonJours * 24
  );
}

export function planClassique(selections: Selection[], ctx: ContexteMise, paris: Pari[], maintenant = Date.now()): Recommandation[] {
  const enCours = new Set(paris.filter((p) => p.statut === "en_cours").flatMap((p) => p.jambes.map((j) => j.eventId)));
  // Une seule sélection par match : on garde celle qui rapporte le plus en espérance.
  const meilleure = new Map<string, Recommandation>();
  for (const s of selections) {
    if (!filtreClassique(s, ctx.reglages, maintenant)) continue;
    const mise = miseClassique(s, ctx);
    const reco: Recommandation = { selection: s, mise, gainAttendu: mise.mise * s.edge, horsBudget: false, dejaJoue: enCours.has(s.eventId) };
    const prev = meilleure.get(s.eventId);
    const score = (x: Recommandation) => x.gainAttendu || x.selection.edge * x.selection.confidence * 1e-4;
    if (!prev || score(reco) > score(prev)) meilleure.set(s.eventId, reco);
  }
  const liste = [...meilleure.values()].sort((a, b) => b.gainAttendu - a.gainAttendu || b.selection.confidence - a.selection.confidence);
  let reste = ctx.protections.expositionRestante;
  for (const r of liste) {
    if (r.dejaJoue || r.mise.mise <= 0) continue;
    if (r.mise.mise > reste + 1e-9) r.horsBudget = true;
    else reste -= r.mise.mise;
  }
  return liste;
}
