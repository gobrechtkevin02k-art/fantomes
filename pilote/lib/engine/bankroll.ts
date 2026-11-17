// Bankroll : grand livre des poches, statistiques, garde-fous et projection vers l'objectif.

import type { EtatApp, Mode, Pari, Reglages } from "../types";
import { clamp, somme } from "./proba";

export const MODES: Mode[] = ["classique", "objectif", "jackpot"];

export interface PointHistorique {
  date: string;
  total: number;
}

export interface EtatBankroll {
  poches: Record<Mode, number>; // disponible par poche (mises en cours déduites)
  engage: Record<Mode, number>; // mises en cours par poche
  disponible: number;
  engageTotal: number;
  total: number; // disponible + engagé
  historique: PointHistorique[];
  pic: number;
  drawdown: number; // baisse depuis le plus haut (0.2 = -20 %)
  apports: number; // bankroll initiale + dépôts - retraits + ajustements
}

const zero = (): Record<Mode, number> => ({ classique: 0, objectif: 0, jackpot: 0 });

type Evenement =
  | { t: number; ordre: number; kind: "mouvement"; montant: number; type: string }
  | { t: number; ordre: number; kind: "place"; pari: Pari }
  | { t: number; ordre: number; kind: "regle"; pari: Pari };

function repartir(montant: number, poids: Record<Mode, number>): Record<Mode, number> {
  const tot = somme(MODES.map((m) => Math.max(0, poids[m])));
  const out = zero();
  for (const m of MODES) out[m] = tot > 0 ? (montant * Math.max(0, poids[m])) / tot : montant / MODES.length;
  return out;
}

/** Rejoue tout l'historique pour obtenir l'état de chaque poche. */
export function calculerBankroll(etat: Pick<EtatApp, "reglages" | "paris" | "mouvements">): EtatBankroll {
  const { reglages, paris, mouvements } = etat;
  const poches = repartir(reglages.bankrollInitiale, reglages.allocation);
  const engage = zero();
  let apports = reglages.bankrollInitiale;
  const t0 = Date.parse(reglages.dateDebut) || 0;
  const historique: PointHistorique[] = [{ date: new Date(t0).toISOString(), total: reglages.bankrollInitiale }];

  const evts: Evenement[] = [];
  for (const mv of mouvements) evts.push({ t: Date.parse(mv.date), ordre: 0, kind: "mouvement", montant: mv.montant, type: mv.type });
  for (const p of paris) {
    evts.push({ t: Date.parse(p.creeLe), ordre: 1, kind: "place", pari: p });
    if (p.statut !== "en_cours" && p.regleLe) evts.push({ t: Date.parse(p.regleLe), ordre: 2, kind: "regle", pari: p });
  }
  evts.sort((a, b) => a.t - b.t || a.ordre - b.ordre);

  const total = () => somme(MODES.map((m) => poches[m] + engage[m]));

  for (const e of evts) {
    if (e.kind === "mouvement") {
      if (e.type === "reequilibrage") {
        const cible = repartir(total(), reglages.allocation);
        for (const m of MODES) poches[m] = cible[m] - engage[m];
      } else if (e.montant >= 0) {
        const part = repartir(e.montant, reglages.allocation);
        for (const m of MODES) poches[m] += part[m];
        apports += e.montant;
      } else {
        // Retrait : réparti au prorata de ce qui est disponible dans chaque poche.
        const part = repartir(e.montant, { classique: poches.classique, objectif: poches.objectif, jackpot: poches.jackpot });
        for (const m of MODES) poches[m] += part[m];
        apports += e.montant;
      }
      historique.push({ date: new Date(e.t).toISOString(), total: total() });
    } else if (e.kind === "place") {
      poches[e.pari.mode] -= e.pari.mise;
      engage[e.pari.mode] += e.pari.mise;
    } else {
      engage[e.pari.mode] -= e.pari.mise;
      poches[e.pari.mode] += e.pari.gain ?? 0;
      historique.push({ date: new Date(e.t).toISOString(), total: total() });
    }
  }

  const tot = total();
  const pic = Math.max(...historique.map((h) => h.total), tot);
  return {
    poches,
    engage,
    disponible: somme(MODES.map((m) => poches[m])),
    engageTotal: somme(MODES.map((m) => engage[m])),
    total: tot,
    historique,
    pic,
    drawdown: pic > 0 ? clamp((pic - tot) / pic, 0, 1) : 0,
    apports,
  };
}

// ---------------------------------------------------------------------------
// Statistiques

export interface Stats {
  nb: number;
  regles: number;
  gagnes: number;
  perdus: number;
  rembourses: number;
  enCours: number;
  misesReglees: number;
  misesEnCours: number;
  retours: number;
  profit: number;
  roi: number; // profit / mises réglées
  tauxReussite: number;
  coteMoyenne: number;
  edgeMoyen: number;
  confianceMoyenne: number;
  profitAttendu: number; // somme des mises × espérance estimée (pour comparer chance / modèle)
  serie: { type: "gagne" | "perdu" | null; longueur: number };
}

export function statistiques(paris: Pari[], mode?: Mode): Stats {
  const ps = mode ? paris.filter((p) => p.mode === mode) : paris;
  const regles = ps.filter((p) => p.statut !== "en_cours");
  const decides = regles.filter((p) => p.statut === "gagne" || p.statut === "perdu");
  const misesReglees = somme(regles.map((p) => p.mise));
  const retours = somme(regles.map((p) => p.gain ?? 0));
  const tries = [...decides].sort((a, b) => Date.parse(b.regleLe ?? b.creeLe) - Date.parse(a.regleLe ?? a.creeLe));
  let serie: Stats["serie"] = { type: null, longueur: 0 };
  if (tries.length) {
    const type = tries[0].statut as "gagne" | "perdu";
    let n = 0;
    for (const p of tries) {
      if (p.statut !== type) break;
      n++;
    }
    serie = { type, longueur: n };
  }
  return {
    nb: ps.length,
    regles: regles.length,
    gagnes: ps.filter((p) => p.statut === "gagne").length,
    perdus: ps.filter((p) => p.statut === "perdu").length,
    rembourses: ps.filter((p) => p.statut === "rembourse").length,
    enCours: ps.filter((p) => p.statut === "en_cours").length,
    misesReglees,
    misesEnCours: somme(ps.filter((p) => p.statut === "en_cours").map((p) => p.mise)),
    retours,
    profit: retours - misesReglees,
    roi: misesReglees > 0 ? (retours - misesReglees) / misesReglees : 0,
    tauxReussite: decides.length ? decides.filter((p) => p.statut === "gagne").length / decides.length : 0,
    coteMoyenne: ps.length ? somme(ps.map((p) => p.cote)) / ps.length : 0,
    edgeMoyen: ps.length ? somme(ps.map((p) => p.edge)) / ps.length : 0,
    confianceMoyenne: ps.length ? somme(ps.map((p) => p.confiance)) / ps.length : 0,
    profitAttendu: somme(regles.map((p) => p.mise * p.edge)),
    serie,
  };
}

// ---------------------------------------------------------------------------
// Garde-fous

export interface Protections {
  pnlJour: number;
  pnlSemaine: number;
  limiteJour: number;
  limiteSemaine: number;
  stopJour: boolean;
  stopSemaine: boolean;
  prudence: boolean; // baisse de plus de 25 % depuis le plus haut : mises divisées par deux
  enPause: boolean;
  expositionMax: number;
  expositionRestante: number;
  bloque: boolean;
  raisons: string[];
}

const debutJour = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function protections(reglages: Reglages, paris: Pari[], bk: EtatBankroll, maintenant = Date.now()): Protections {
  const j0 = debutJour(maintenant);
  const s0 = maintenant - 7 * 86_400_000;
  const pnlDepuis = (t: number) =>
    somme(paris.filter((p) => p.statut !== "en_cours" && p.regleLe && Date.parse(p.regleLe) >= t).map((p) => (p.gain ?? 0) - p.mise));
  const pnlJour = pnlDepuis(j0);
  const pnlSemaine = pnlDepuis(s0);
  const limiteJour = ((bk.total - pnlJour) * reglages.stopLossJour) / 100;
  const limiteSemaine = ((bk.total - pnlSemaine) * reglages.stopLossSemaine) / 100;
  const stopJour = reglages.stopLossJour > 0 && -pnlJour >= limiteJour;
  const stopSemaine = reglages.stopLossSemaine > 0 && -pnlSemaine >= limiteSemaine;
  const enPause = !!reglages.pause && Date.parse(reglages.pause) > maintenant;
  const prudence = bk.drawdown >= 0.25;
  const expositionMax = (bk.total * reglages.expositionMax) / 100;
  const expositionRestante = Math.max(0, expositionMax - bk.engageTotal);
  const raisons: string[] = [];
  if (enPause) raisons.push("Pause volontaire en cours.");
  if (stopJour) raisons.push("Limite de perte du jour atteinte : reprise demain.");
  if (stopSemaine) raisons.push("Limite de perte sur 7 jours atteinte.");
  if (bk.total <= 0) raisons.push("Bankroll vide.");
  return {
    pnlJour,
    pnlSemaine,
    limiteJour,
    limiteSemaine,
    stopJour,
    stopSemaine,
    prudence,
    enPause,
    expositionMax,
    expositionRestante,
    bloque: enPause || stopJour || stopSemaine || bk.total <= 0,
    raisons,
  };
}

// ---------------------------------------------------------------------------
// Objectif

export type StatutObjectif = "aucun" | "atteint" | "en_avance" | "dans_les_temps" | "en_retard" | "indetermine";

export interface Projection {
  statut: StatutObjectif;
  progression: number; // 0 → 1 entre la bankroll de départ et l'objectif
  joursRestants: number;
  croissanceRequise: number; // croissance mensuelle nécessaire (0.05 = +5 %/mois)
  croissanceObservee: number | null; // croissance mensuelle observée sur les paris réglés
  dateEstimee: string | null;
  ambitieux: boolean; // plus de 15 %/mois nécessaires
}

export function projection(reglages: Reglages, paris: Pari[], bk: EtatBankroll, maintenant = Date.now()): Projection {
  const obj = reglages.objectif;
  const vide: Projection = { statut: "aucun", progression: 0, joursRestants: 0, croissanceRequise: 0, croissanceObservee: null, dateEstimee: null, ambitieux: false };
  if (!obj || obj.montant <= 0) return vide;
  const depart = bk.apports;
  const progression = obj.montant > depart ? clamp((bk.total - depart) / (obj.montant - depart), 0, 1) : bk.total >= obj.montant ? 1 : 0;
  const joursRestants = Math.max(0, (Date.parse(obj.date) - maintenant) / 86_400_000);
  if (bk.total >= obj.montant) return { ...vide, statut: "atteint", progression: 1, joursRestants };

  const croissanceRequise = joursRestants > 0 ? (obj.montant / Math.max(bk.total, 1e-9)) ** (30 / joursRestants) - 1 : Infinity;
  const regles = paris.filter((p) => p.statut !== "en_cours");
  const jours = (maintenant - Date.parse(reglages.dateDebut)) / 86_400_000;
  let croissanceObservee: number | null = null;
  let dateEstimee: string | null = null;
  if (regles.length >= 10 && jours >= 14 && depart > 0) {
    const profit = somme(regles.map((p) => (p.gain ?? 0) - p.mise));
    const facteur = Math.max(1e-6, (depart + profit) / depart);
    croissanceObservee = facteur ** (30 / jours) - 1;
    if (croissanceObservee > 0) {
      const moisNecessaires = Math.log(obj.montant / bk.total) / Math.log(1 + croissanceObservee);
      dateEstimee = new Date(maintenant + moisNecessaires * 30 * 86_400_000).toISOString();
    }
  }
  let statut: StatutObjectif = "indetermine";
  if (croissanceObservee !== null) {
    if (croissanceObservee >= croissanceRequise * 1.2) statut = "en_avance";
    else if (croissanceObservee >= croissanceRequise * 0.9) statut = "dans_les_temps";
    else statut = "en_retard";
  }
  return { statut, progression, joursRestants, croissanceRequise, croissanceObservee, dateEstimee, ambitieux: croissanceRequise > 0.15 };
}
