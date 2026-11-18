// Analyses de performance : statistiques fines, calibration de l'indice, part de chance,
// cote de clôture (CLV) et simulateur « si tu avais suivi ».

import type { Cloture, Mode, Mouvement, Pari } from "../types";
import type { PointHistorique } from "./bankroll";
import { parties } from "./temps";
import { nomSport } from "../sports";

export const profitPari = (p: Pari) => (p.gain ?? 0) - p.mise;
const regles = (paris: Pari[]) => paris.filter((p) => p.statut !== "en_cours" && p.regleLe).sort((a, b) => Date.parse(a.regleLe!) - Date.parse(b.regleLe!));

export interface LigneStats {
  cle: string;
  libelle: string;
  paris: number;
  gagnes: number;
  perdus: number;
  mises: number;
  resultat: number;
  roi: number;
  reussite: number;
  reussiteAttendue: number; // moyenne des probabilités estimées (paris gagnés ou perdus)
}

function agreger(paris: Pari[], cle: (p: Pari) => string, libelle: (cle: string) => string, ordre?: string[]): LigneStats[] {
  const groupes = new Map<string, Pari[]>();
  for (const p of regles(paris)) {
    const k = cle(p);
    groupes.set(k, [...(groupes.get(k) ?? []), p]);
  }
  const lignes = [...groupes].map(([k, ps]) => {
    const decides = ps.filter((p) => p.statut === "gagne" || p.statut === "perdu");
    const mises = ps.reduce((t, p) => t + p.mise, 0);
    const resultat = ps.reduce((t, p) => t + profitPari(p), 0);
    return {
      cle: k,
      libelle: libelle(k),
      paris: ps.length,
      gagnes: ps.filter((p) => p.statut === "gagne").length,
      perdus: ps.filter((p) => p.statut === "perdu").length,
      mises,
      resultat,
      roi: mises > 0 ? resultat / mises : 0,
      reussite: decides.length ? decides.filter((p) => p.statut === "gagne").length / decides.length : 0,
      reussiteAttendue: decides.length ? decides.reduce((t, p) => t + p.probaEstimee, 0) / decides.length : 0,
    };
  });
  if (ordre) lignes.sort((a, b) => ordre.indexOf(a.cle) - ordre.indexOf(b.cle));
  return lignes;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function parMois(paris: Pari[], tz: string): LigneStats[] {
  return agreger(
    paris,
    (p) => {
      const d = parties(Date.parse(p.regleLe!), tz);
      return `${d.annee}-${String(d.mois).padStart(2, "0")}`;
    },
    (k) => `${MOIS[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`,
  ).sort((a, b) => b.cle.localeCompare(a.cle));
}

export function parSport(paris: Pari[]): LigneStats[] {
  return agreger(
    paris,
    (p) => (p.jambes.length > 1 ? "combines" : p.jambes[0]?.sportKey ?? "autre"),
    (k) => (k === "combines" ? "Combinés" : nomSport(k)),
  ).sort((a, b) => b.paris - a.paris);
}

const TRANCHES_COTE: [string, string, number][] = [
  ["a", "moins de 1,50", 1.5],
  ["b", "1,50 à 2", 2],
  ["c", "2 à 3", 3],
  ["d", "3 à 5", 5],
  ["e", "5 et plus", Infinity],
];

export function parCote(paris: Pari[]): LigneStats[] {
  return agreger(
    paris,
    (p) => TRANCHES_COTE.find(([, , max]) => p.cote < max)![0],
    (k) => TRANCHES_COTE.find(([c]) => c === k)![1],
    TRANCHES_COTE.map(([c]) => c),
  );
}

const TRANCHES_INDICE: [string, string, number][] = [
  ["a", "moins de 60", 60],
  ["b", "60 à 70", 70],
  ["c", "70 à 80", 80],
  ["d", "80 à 90", 90],
  ["e", "90 et plus", Infinity],
];

/** Calibration : un indice plus haut donne-t-il vraiment de meilleurs résultats ? */
export function parIndice(paris: Pari[]): LigneStats[] {
  return agreger(
    paris,
    (p) => TRANCHES_INDICE.find(([, , max]) => p.confiance < max)![0],
    (k) => `indice ${TRANCHES_INDICE.find(([c]) => c === k)![1]}`,
    TRANCHES_INDICE.map(([c]) => c),
  );
}

export interface Series {
  gainsMax: number;
  pertesMax: number;
  enCours: { type: "gagne" | "perdu" | null; n: number };
}

export function series(paris: Pari[]): Series {
  let gainsMax = 0;
  let pertesMax = 0;
  let type: "gagne" | "perdu" | null = null;
  let n = 0;
  for (const p of regles(paris)) {
    if (p.statut !== "gagne" && p.statut !== "perdu") continue;
    if (p.statut === type) n++;
    else {
      type = p.statut;
      n = 1;
    }
    if (type === "gagne") gainsMax = Math.max(gainsMax, n);
    else pertesMax = Math.max(pertesMax, n);
  }
  return { gainsMax, pertesMax, enCours: { type, n } };
}

export interface Baisse {
  montant: number;
  pct: number | null; // par rapport à la bankroll au plus haut
  du: string | null;
  au: string | null;
}

/** Plus grosse baisse du résultat des paris (du plus haut au plus bas qui suit). */
export function plusGrosseBaisse(paris: Pari[], depart?: number): Baisse {
  let cumul = 0;
  let pic = 0;
  let datePic: string | null = null;
  let pire: Baisse = { montant: 0, pct: null, du: null, au: null };
  for (const p of regles(paris)) {
    cumul += profitPari(p);
    if (cumul > pic) {
      pic = cumul;
      datePic = p.regleLe!;
    }
    const baisse = pic - cumul;
    if (baisse > pire.montant) pire = { montant: baisse, pct: depart ? baisse / (depart + pic) : null, du: datePic, au: p.regleLe! };
  }
  return pire;
}

export interface Extremes {
  meilleurPari: Pari | null;
  pirePari: Pari | null;
  meilleurMois: LigneStats | null;
  pireMois: LigneStats | null;
}

export function extremes(paris: Pari[], tz: string): Extremes {
  const r = regles(paris);
  const mois = parMois(paris, tz);
  const tri = <T,>(xs: T[], f: (x: T) => number) => [...xs].sort((a, b) => f(b) - f(a));
  return {
    meilleurPari: r.length ? tri(r, profitPari)[0] : null,
    pirePari: r.length ? tri(r, (p) => -profitPari(p))[0] : null,
    meilleurMois: mois.length ? tri(mois, (m) => m.resultat)[0] : null,
    pireMois: mois.length ? tri(mois, (m) => -m.resultat)[0] : null,
  };
}

/** Part de chance : ce que les paris valaient selon le modèle, comparé au résultat réel. */
export function chance(paris: Pari[]): { attendu: number; reel: number; ecart: number } {
  const r = regles(paris);
  const attendu = r.reduce((t, p) => t + p.mise * p.edge, 0);
  const reel = r.reduce((t, p) => t + profitPari(p), 0);
  return { attendu, reel, ecart: reel - attendu };
}

// ---------------------------------------------------------------------------
// Cote de clôture (CLV)

/** Avantage du pari par rapport au juste prix de clôture : cote obtenue × probabilité juste à la clôture − 1. */
export function clvPari(p: Pari, clotures: Record<string, Cloture>): number | null {
  let proba = 1;
  for (const j of p.jambes) {
    if (j.statut === "rembourse") continue;
    const c = clotures[j.selectionId];
    if (!c) return null;
    proba *= c.probaJuste;
  }
  const facteur = p.jambes.filter((j) => j.statut === "rembourse").reduce((f, j) => f / j.odds, 1);
  return p.cote * facteur * proba - 1;
}

export function clvGlobal(paris: Pari[], clotures: Record<string, Cloture>): { moyenne: number; part: number; n: number } {
  const v = paris.map((p) => clvPari(p, clotures)).filter((x): x is number => x !== null);
  return { moyenne: v.length ? v.reduce((t, x) => t + x, 0) / v.length : 0, part: v.length ? v.filter((x) => x > 0).length / v.length : 0, n: v.length };
}

// ---------------------------------------------------------------------------
// Simulateur « si tu avais suivi »

export interface Simulation {
  final: number;
  profit: number;
  roi: number;
  paris: number;
  courbe: PointHistorique[];
}

/**
 * Rejoue les paris en misant la même part de bankroll que le compte suivi :
 * si le compte a misé 2 % de sa bankroll, le suiveur mise 2 % de la sienne.
 * Les dépôts et retraits du compte suivi changent sa bankroll mais pas celle du suiveur.
 */
export function simulerSuivi(args: { paris: Pari[]; mouvements: Mouvement[]; bankrollInitiale: number; dateDebut: string; capital: number; modes: Mode[] }): Simulation {
  const { paris, mouvements, bankrollInitiale, dateDebut, capital, modes } = args;
  type E = { t: number; o: number; f: () => void };
  const evts: E[] = [];
  let compte = bankrollInitiale;
  let suiveur = capital;
  let nb = 0;
  const mises = new Map<string, number>();
  const courbe: PointHistorique[] = [{ date: dateDebut, total: capital }];

  for (const m of mouvements) if (m.type !== "reequilibrage") evts.push({ t: Date.parse(m.date), o: 0, f: () => (compte += m.montant) });
  for (const p of paris) {
    const suivi = modes.includes(p.mode);
    evts.push({
      t: Date.parse(p.creeLe),
      o: 1,
      f: () => {
        if (suivi && compte > 0) mises.set(p.id, (p.mise / compte) * suiveur);
      },
    });
    if (p.statut !== "en_cours" && p.regleLe)
      evts.push({
        t: Date.parse(p.regleLe),
        o: 2,
        f: () => {
          compte += profitPari(p);
          const m = mises.get(p.id);
          if (m === undefined) return;
          suiveur += m * ((p.gain ?? 0) / p.mise - 1);
          nb++;
          courbe.push({ date: p.regleLe!, total: suiveur });
        },
      });
  }
  evts.sort((a, b) => a.t - b.t || a.o - b.o);
  for (const e of evts) e.f();
  return { final: suiveur, profit: suiveur - capital, roi: capital > 0 ? (suiveur - capital) / capital : 0, paris: nb, courbe };
}
