// Suivi en direct : probabilité qu'un pari en cours passe encore, valeur juste de la position
// et conseil (garder, sécuriser par un cash-out, ou limiter la casse).
//
// Source de la probabilité, par ordre de préférence :
// 1. les cotes en direct des bookmakers (consensus, marge retirée) ;
// 2. à défaut, un modèle simple à partir du score et du temps écoulé (football : Poisson ; basket : loi normale).
//
// Rappel honnête : un cash-out coûte en moyenne une petite marge. Le conseil ne le recommande que pour
// réduire un risque important (gain qui pèse lourd dans la bankroll) ou pour récupérer au moins la valeur juste.

import type { Jambe, Pari, ScoreEvent, SportEvent } from "../types";
import { clamp, devigPuissance, logit, moyennePonderee, phi } from "./proba";
import { lignesDuMarche, POIDS_BOOKMAKERS } from "./valeur";
import { cote, eur, pct } from "../format";

export type Conseil = "garder" | "securiser" | "limiter";

export interface EtatJambeDirect {
  selectionId: string;
  label: string;
  match: string;
  score: string | null;
  enCours: boolean;
  p: number; // probabilité actuelle que la jambe passe
  source: "cotes" | "modele" | "avant-match" | "terminee";
}

export interface EvaluationDirect {
  pariId: string;
  pLive: number;
  pDepart: number;
  gainPotentiel: number;
  valeurJuste: number;
  conseil: Conseil;
  seuilCashout: number | null;
  message: string;
  jambes: EtatJambeDirect[];
}

// ---------------------------------------------------------------------------
// Modèles à partir du score

function poisson(k: number, l: number): number {
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i++) p *= l / i;
  return p;
}

function distribution(l: number, max = 12): number[] {
  return Array.from({ length: max + 1 }, (_, k) => poisson(k, l));
}

/** Probabilité d'une issue de football compte tenu du score actuel et des buts attendus restants. */
function probaFootIssue(issue: "home" | "draw" | "away" | "over" | "under", point: number, h: number, a: number, lh: number, la: number): number {
  const dh = distribution(lh);
  const da = distribution(la);
  let p = 0;
  for (let i = 0; i < dh.length; i++)
    for (let j = 0; j < da.length; j++) {
      const fh = h + i;
      const fa = a + j;
      const ok =
        issue === "home" ? fh > fa : issue === "away" ? fa > fh : issue === "draw" ? fh === fa : issue === "over" ? fh + fa > point : fh + fa < point;
      if (ok) p += dh[i] * da[j];
    }
  return p;
}

function bissection(f: (x: number) => number, cible: number, lo: number, hi: number, croissante: boolean): number {
  for (let k = 0; k < 50; k++) {
    const m = (lo + hi) / 2;
    if (f(m) < cible === croissante) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Minute de jeu estimée à partir de l'heure de début (mi-temps de 15 min). */
export function minuteFoot(commence: string, maintenant: number): number {
  const e = (maintenant - Date.parse(commence)) / 60_000;
  if (e <= 45) return Math.max(0, e);
  if (e <= 60) return 45;
  return Math.min(90, e - 15);
}

export function probaFootEnDirect(j: Jambe, h: number, a: number, minute: number): number | null {
  const r = clamp((90 - minute) / 90, 0, 1);
  if (j.market === "totals" && j.point !== undefined) {
    const over = (l: number) => probaFootIssue("over", j.point!, 0, 0, l / 2, l / 2);
    const pOver = j.issue === "Over" ? j.fairProb : 1 - j.fairProb;
    const l = bissection(over, pOver, 0.2, 8, true);
    return probaFootIssue(j.issue === "Over" ? "over" : "under", j.point, h, a, (l / 2) * r, (l / 2) * r);
  }
  if (j.market === "h2h") {
    if (j.issue === "Draw") {
      const l = bissection((x) => probaFootIssue("draw", 0, 0, 0, x / 2, x / 2), j.fairProb, 0.5, 6, false);
      return probaFootIssue("draw", 0, h, a, (l / 2) * r, (l / 2) * r);
    }
    const domicile = j.issue === j.home;
    const total = 2.6;
    const pDom = (part: number) => probaFootIssue(domicile ? "home" : "away", 0, 0, 0, total * part, total * (1 - part));
    const part = bissection(pDom, j.fairProb, 0.03, 0.97, domicile);
    return probaFootIssue(domicile ? "home" : "away", 0, h, a, total * part * r, total * (1 - part) * r);
  }
  return null;
}

function probit(p: number): number {
  return bissection(phi, clamp(p, 1e-6, 1 - 1e-6), -8, 8, true);
}

/** Basket : écart et total restants modélisés par une loi normale. Durée réelle d'un match ≈ 2 h 30. */
export function probaBasketEnDirect(j: Jambe, h: number, a: number, commence: string, maintenant: number): number | null {
  const r = clamp(1 - (maintenant - Date.parse(commence)) / (150 * 60_000), 0, 1);
  if (r <= 0.001) return null;
  const sigmaEcart = 17;
  const sigmaTotal = 18;
  if (j.market === "h2h") {
    const nous = j.issue === j.home ? h - a : a - h;
    const mu = sigmaEcart * probit(j.fairProb);
    return phi((nous + mu * r) / (sigmaEcart * Math.sqrt(r)));
  }
  if (j.market === "totals" && j.point !== undefined) {
    const pOver = j.issue === "Over" ? j.fairProb : 1 - j.fairProb;
    const attendu = j.point + sigmaTotal * probit(pOver);
    const projete = h + a + attendu * r;
    const pO = 1 - phi((j.point - projete) / (sigmaTotal * Math.sqrt(r)));
    return j.issue === "Over" ? pO : 1 - pO;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Probabilité à partir des cotes en direct

export function probaMarche(ev: SportEvent, j: Jambe): number | null {
  const cle = j.market === "h2h" ? "h2h" : `${j.market}:${j.market === "spreads" ? (j.issue === j.home ? j.point : -(j.point ?? 0)) : j.point}`;
  const valeurs: number[] = [];
  const poids: number[] = [];
  for (const b of ev.bookmakers) {
    for (const m of b.markets) {
      for (const l of lignesDuMarche(m, ev.home)) {
        if (l.cle !== cle) continue;
        const k = l.issues.findIndex((i) => i.id === j.issue);
        if (k < 0) continue;
        valeurs.push(logit(devigPuissance(l.issues.map((i) => i.price))[k]));
        poids.push(POIDS_BOOKMAKERS[b.key] ?? 1);
      }
    }
  }
  if (!valeurs.length) return null;
  const { moyenne } = moyennePonderee(valeurs, poids);
  return 1 / (1 + Math.exp(-moyenne));
}

// ---------------------------------------------------------------------------
// Évaluation d'un pari en cours

export function evaluerPariDirect(p: Pari, scores: ScoreEvent[], events: SportEvent[], maintenant: number, bankroll: number): EvaluationDirect | null {
  if (p.statut !== "en_cours") return null;
  const scoreParId = new Map(scores.map((s) => [s.id, s]));
  const evParId = new Map(events.map((e) => [e.id, e]));
  const jambes: EtatJambeDirect[] = [];
  let pLive = 1;
  let pDepart = 1;
  let facteurRembourse = 1;
  let unEnCours = false;

  for (const j of p.jambes) {
    pDepart *= j.fairProb;
    const base = { selectionId: j.selectionId, label: j.label, match: `${j.home} – ${j.away}` };
    if (j.statut === "perdu") return null; // rien à sauver
    if (j.statut === "gagne") {
      jambes.push({ ...base, score: null, enCours: false, p: 1, source: "terminee" });
      continue;
    }
    if (j.statut === "rembourse") {
      facteurRembourse /= j.odds;
      jambes.push({ ...base, score: null, enCours: false, p: 1, source: "terminee" });
      continue;
    }
    const sc = scoreParId.get(j.eventId);
    const commence = Date.parse(j.commence) <= maintenant;
    const sh = sc?.scores?.find((x) => x.name === j.home)?.score;
    const sa = sc?.scores?.find((x) => x.name === j.away)?.score;
    const score = sh !== undefined && sa !== undefined ? `${sh}-${sa}` : null;
    if (!commence || sc?.completed) {
      jambes.push({ ...base, score, enCours: false, p: j.fairProb, source: "avant-match" });
      pLive *= j.fairProb;
      continue;
    }
    unEnCours = true;
    let pj: number | null = null;
    let source: EtatJambeDirect["source"] = "cotes";
    const ev = evParId.get(j.eventId);
    if (ev && Date.parse(ev.commence) <= maintenant) pj = probaMarche(ev, j);
    if (pj === null && sh !== undefined && sa !== undefined) {
      source = "modele";
      if (j.sportKey.startsWith("soccer")) pj = probaFootEnDirect(j, sh, sa, minuteFoot(j.commence, maintenant));
      else if (j.sportKey.startsWith("basketball")) pj = probaBasketEnDirect(j, sh, sa, j.commence, maintenant);
    }
    if (pj === null) {
      pj = j.fairProb;
      source = "avant-match";
    }
    pj = clamp(pj, 0.001, 0.999);
    jambes.push({ ...base, score, enCours: true, p: pj, source });
    pLive *= pj;
  }
  if (!unEnCours) return null;

  const gainPotentiel = p.mise * p.cote * facteurRembourse;
  const valeurJuste = gainPotentiel * pLive;
  const scoreTexte = jambes
    .filter((j) => j.enCours && j.score)
    .map((j) => `${j.match} ${j.score}`)
    .join(", ");
  const contexte = scoreTexte ? ` (${scoreTexte})` : "";
  let conseil: Conseil = "garder";
  let seuil: number | null = null;
  let message = `Rien à faire : environ ${pct(pLive, 0)} de chances de passer${contexte}. On laisse courir.`;

  if (pLive >= 0.8 && gainPotentiel - p.mise >= 0.03 * bankroll) {
    conseil = "securiser";
    seuil = Math.floor(valeurJuste * 0.95 * 100) / 100;
    message = `Ton pari est bien parti : environ ${pct(pLive, 0)} de chances de passer${contexte}. Sa valeur juste est de ${eur(valeurJuste)}. Si Winamax te propose au moins ${eur(seuil)} en cash-out, tu peux sécuriser ; en dessous, garde-le.`;
  } else if (pLive < 0.03) {
    message = `Il faudrait un petit miracle (${pct(pLive, 0)} de chances${contexte}) : il n'y a presque plus rien à récupérer en cash-out, on laisse courir.`;
  } else if (pLive <= 0.2 && pDepart >= 0.3) {
    conseil = "limiter";
    seuil = Math.floor(valeurJuste * 100) / 100;
    message = `Ça tourne mal : il reste environ ${pct(pLive, 0)} de chances${contexte}. Si Winamax te propose au moins ${eur(seuil)} en cash-out, récupère-les. En dessous, laisse courir : couper sous la valeur juste, c'est perdre deux fois.`;
  }

  return { pariId: p.id, pLive, pDepart, gainPotentiel, valeurJuste, conseil, seuilCashout: seuil, message, jambes };
}

export function titreConseil(e: EvaluationDirect, p: Pari): string {
  const nom = p.jambes.length > 1 ? `combiné à ${cote(p.cote)}` : p.jambes[0]?.label ?? "ton pari";
  if (e.conseil === "securiser") return `🟢 Sécuriser ${nom} ?`;
  if (e.conseil === "limiter") return `🟠 Limiter la casse sur ${nom} ?`;
  return `⏱️ ${nom} en direct`;
}
