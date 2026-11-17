// Outils probabilistes : marges, retrait de la marge du bookmaker, loi normale.

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const somme = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export const logit = (p: number) => {
  const q = clamp(p, 1e-9, 1 - 1e-9);
  return Math.log(q / (1 - q));
};
export const sigmoide = (x: number) => 1 / (1 + Math.exp(-x));

/** Marge du bookmaker sur un marché complet (0.05 = 5 %). */
export function marge(cotes: number[]): number {
  return somme(cotes.map((o) => 1 / o)) - 1;
}

/** Retrait de marge proportionnel (la marge est répartie au prorata). */
export function devigMultiplicatif(cotes: number[]): number[] {
  const inv = cotes.map((o) => 1 / o);
  const s = somme(inv);
  return inv.map((x) => x / s);
}

/**
 * Retrait de marge par la méthode « puissance » : on cherche k tel que Σ (1/cote)^k = 1.
 * Elle corrige mieux le biais favori / outsider (les bookmakers chargent davantage la marge sur les grosses cotes).
 */
export function devigPuissance(cotes: number[]): number[] {
  const inv = cotes.map((o) => 1 / o);
  const s = somme(inv);
  if (s <= 1 || inv.some((x) => x >= 1)) return inv.map((x) => x / s);
  let lo = 1;
  let hi = 2;
  while (somme(inv.map((x) => x ** hi)) > 1 && hi < 64) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (somme(inv.map((x) => x ** mid)) > 1) lo = mid;
    else hi = mid;
  }
  const p = inv.map((x) => x ** ((lo + hi) / 2));
  const t = somme(p);
  return p.map((x) => x / t);
}

/** Fonction de répartition de la loi normale centrée réduite. */
export function phi(z: number): number {
  // Approximation d'Abramowitz & Stegun 7.1.26 (erreur < 1.5e-7).
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Moyenne et écart-type pondérés. */
export function moyennePonderee(valeurs: number[], poids: number[]): { moyenne: number; ecart: number } {
  const w = somme(poids);
  const m = somme(valeurs.map((v, i) => v * poids[i])) / w;
  const v = somme(valeurs.map((x, i) => poids[i] * (x - m) ** 2)) / w;
  return { moyenne: m, ecart: Math.sqrt(v) };
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function prng(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
