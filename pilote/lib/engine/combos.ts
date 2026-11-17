// Constructeur de combinés : pour une cote minimale donnée, trouve la combinaison de matchs
// qui a la plus grande probabilité de passer (une seule sélection par match).
//
// Formulation : minimiser Σ -log(p_i) sous la contrainte Σ log(cote_i) ≥ log(cible)
// → programmation dynamique de type « sac à dos à choix multiples » sur la log-cote discrétisée.

import type { Selection } from "../types";
import { phi } from "./proba";
import { probaAjustee } from "./valeur";

export interface Combo {
  jambes: Selection[];
  cote: number;
  probaJuste: number; // probabilité de passer selon le consensus
  probaAjustee: number; // probabilité prudente (avantage réduit selon la confiance)
  edge: number; // espérance par euro misé selon le consensus
  confiance: number; // probabilité (modèle) que le combiné ait une espérance positive
  premierMatch: string;
  dernierMatch: string;
}

export function evaluerCombo(jambes: Selection[]): Combo {
  const cote = jambes.reduce((c, s) => c * s.odds, 1);
  const probaJuste = jambes.reduce((p, s) => p * s.fairProb, 1);
  const pAdj = jambes.reduce((p, s) => p * probaAjustee(s), 1);
  // Confiance : log-espérance du combiné rapportée à son incertitude cumulée.
  const logEdge = jambes.reduce((t, s) => t + Math.log(s.fairProb * s.odds), 0);
  const variance = jambes.reduce((v, s) => v + (s.sigma * (1 - s.fairProb)) ** 2, 0);
  const confiance = variance > 0 ? Math.min(99, Math.max(1, 100 * phi(logEdge / Math.sqrt(variance)))) : 50;
  const dates = jambes.map((s) => s.commence).sort();
  return {
    jambes: [...jambes].sort((a, b) => a.commence.localeCompare(b.commence)),
    cote,
    probaJuste,
    probaAjustee: pAdj,
    edge: probaJuste * cote - 1,
    confiance: Math.round(confiance * 10) / 10,
    premierMatch: dates[0],
    dernierMatch: dates[dates.length - 1],
  };
}

interface Item {
  sel: Selection;
  w: number;
  c: number;
}

const BINS = 400;

/**
 * Pour chaque nombre de jambes k (1..jambesMax), le meilleur combiné atteignant la cote cible.
 * Retourne un tableau indexé par k (undefined si impossible avec k jambes).
 */
export function meilleursCombosParTaille(pool: Selection[], cible: number, jambesMax: number): (Selection[] | undefined)[] {
  const out: (Selection[] | undefined)[] = new Array(jambesMax + 1).fill(undefined);
  if (cible <= 1 || pool.length === 0 || jambesMax < 1) return out;
  const W = BINS;
  const delta = Math.log(cible) / W;

  // Regroupement par match (au plus une sélection par match) en ne gardant que les 3 meilleures issues.
  const groupes = new Map<string, Item[]>();
  for (const s of pool) {
    const p = probaAjustee(s);
    if (!(p > 0 && p < 1) || s.odds <= 1) continue;
    const w = Math.floor(Math.log(s.odds) / delta); // arrondi par défaut : la cote réelle est toujours ≥ la cote comptée
    if (w < 1) continue;
    const arr = groupes.get(s.eventId) ?? [];
    arr.push({ sel: s, w: Math.min(w, W), c: -Math.log(p) });
    groupes.set(s.eventId, arr);
  }
  const liste = [...groupes.values()]
    .map((items) => items.sort((a, b) => b.w / b.c - a.w / a.c).slice(0, 3))
    .sort((a, b) => b[0].w / b[0].c - a[0].w / a[0].c)
    .slice(0, 250);
  if (liste.length === 0) return out;

  const L = jambesMax;
  const taille = (L + 1) * (W + 1);
  let dp = new Float64Array(taille).fill(Infinity);
  dp[0] = 0;
  const choix: Int8Array[] = [];
  const precedent: Int16Array[] = [];

  for (const items of liste) {
    const ndp = dp.slice();
    const ch = new Int8Array(taille);
    const pr = new Int16Array(taille);
    for (let k = 0; k < L; k++) {
      for (let w = 0; w <= W; w++) {
        const base = dp[k * (W + 1) + w];
        if (base === Infinity) continue;
        for (let j = 0; j < items.length; j++) {
          const it = items[j];
          const nw = Math.min(W, w + it.w);
          const idx = (k + 1) * (W + 1) + nw;
          const v = base + it.c;
          if (v < ndp[idx] - 1e-12) {
            ndp[idx] = v;
            ch[idx] = j + 1;
            pr[idx] = w;
          }
        }
      }
    }
    dp = ndp;
    choix.push(ch);
    precedent.push(pr);
  }

  for (let k = 1; k <= L; k++) {
    if (dp[k * (W + 1) + W] === Infinity) continue;
    const jambes: Selection[] = [];
    let kk = k;
    let w = W;
    for (let g = liste.length - 1; g >= 0 && kk > 0; g--) {
      const idx = kk * (W + 1) + w;
      const c = choix[g][idx];
      if (c > 0) {
        jambes.push(liste[g][c - 1].sel);
        w = precedent[g][idx];
        kk--;
      }
    }
    if (kk === 0) out[k] = jambes;
  }
  return out;
}

export interface PropositionCombo extends Combo {
  titre: string;
  description: string;
}

const signature = (c: Combo) => c.jambes.map((s) => s.id).sort().join("~");

/**
 * Propositions variées pour une cote cible : le plus sûr, le plus court, une alternative sans les mêmes matchs.
 */
export function proposerCombos(pool: Selection[], cible: number, jambesMax: number): PropositionCombo[] {
  const parTaille = meilleursCombosParTaille(pool, cible, jambesMax);
  const combos = parTaille.filter((x): x is Selection[] => !!x).map(evaluerCombo);
  if (combos.length === 0) return [];
  const props: PropositionCombo[] = [];
  const vus = new Set<string>();
  const ajouter = (c: Combo | undefined, titre: string, description: string) => {
    if (!c) return;
    const sig = signature(c);
    if (vus.has(sig)) return;
    vus.add(sig);
    props.push({ ...c, titre, description });
  };

  const plusSur = [...combos].sort((a, b) => b.probaAjustee - a.probaAjustee)[0];
  ajouter(plusSur, "Le plus sûr", "La plus forte probabilité de passer pour ta cote cible.");

  const plusCourt = combos[0]; // tailles croissantes
  ajouter(plusCourt, "Le plus court", "Le moins de matchs possible : moins de choses peuvent mal tourner.");

  // Alternative : mêmes critères, sans aucun des matchs de la meilleure proposition.
  const exclus = new Set(plusSur.jambes.map((s) => s.eventId));
  const alt = meilleursCombosParTaille(pool.filter((s) => !exclus.has(s.eventId)), cible, jambesMax)
    .filter((x): x is Selection[] => !!x)
    .map(evaluerCombo)
    .sort((a, b) => b.probaAjustee - a.probaAjustee)[0];
  ajouter(alt, "Alternative", "Une autre combinaison, sans aucun match en commun avec « Le plus sûr ».");

  const valeur = [...combos].filter((c) => c.edge > 0).sort((a, b) => b.edge * b.confiance - a.edge * a.confiance)[0];
  ajouter(valeur, "Meilleure valeur", "La meilleure espérance de gain selon le consensus des bookmakers.");

  return props;
}
