// Règlement automatique des paris à partir des scores finaux.

import type { Jambe, Pari, ScoreEvent, StatutJambe, StatutPari } from "../types";

export function reglerJambe(j: Jambe, score: ScoreEvent | undefined): StatutJambe {
  if (!score || !score.completed || !score.scores) return j.statut;
  const sh = score.scores.find((s) => s.name === j.home);
  const sa = score.scores.find((s) => s.name === j.away);
  if (!sh || !sa) return j.statut;
  const h = Number(sh.score);
  const a = Number(sa.score);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return j.statut;

  if (j.market === "h2h") {
    if (j.issue === "Draw") return h === a ? "gagne" : "perdu";
    if (j.issue === j.home) return h > a ? "gagne" : "perdu";
    if (j.issue === j.away) return a > h ? "gagne" : "perdu";
    return j.statut;
  }
  if (j.market === "totals" && j.point !== undefined) {
    const t = h + a;
    if (t === j.point) return "rembourse";
    if (j.issue === "Over") return t > j.point ? "gagne" : "perdu";
    if (j.issue === "Under") return t < j.point ? "gagne" : "perdu";
  }
  if (j.market === "spreads" && j.point !== undefined) {
    const ecart = (j.issue === j.home ? h - a : a - h) + j.point;
    if (ecart === 0) return "rembourse";
    return ecart > 0 ? "gagne" : "perdu";
  }
  return j.statut;
}

/** Statut et montant retourné d'un pari d'après l'état de ses jambes. */
export function evaluerPari(p: Pick<Pari, "jambes" | "mise" | "cote">): { statut: StatutPari; gain: number } {
  const js = p.jambes;
  if (js.some((j) => j.statut === "perdu")) return { statut: "perdu", gain: 0 };
  if (js.some((j) => j.statut === "en_cours")) return { statut: "en_cours", gain: 0 };
  if (js.every((j) => j.statut === "rembourse")) return { statut: "rembourse", gain: p.mise };
  // Une jambe remboursée compte pour une cote de 1 dans un combiné.
  const facteur = js.filter((j) => j.statut === "rembourse").reduce((f, j) => f / j.odds, 1);
  return { statut: "gagne", gain: Math.round(p.mise * p.cote * facteur * 100) / 100 };
}

/** Met à jour les paris en cours à partir des scores. Retourne les paris modifiés uniquement. */
export function reglerParis(paris: Pari[], scores: ScoreEvent[], maintenant = Date.now()): Pari[] {
  const parId = new Map(scores.map((s) => [s.id, s]));
  const modifies: Pari[] = [];
  for (const p of paris) {
    if (p.statut !== "en_cours") continue;
    let change = false;
    const jambes = p.jambes.map((j) => {
      if (j.statut !== "en_cours") return j;
      const st = reglerJambe(j, parId.get(j.eventId));
      if (st !== j.statut) change = true;
      return st === j.statut ? j : { ...j, statut: st };
    });
    if (!change) continue;
    const { statut, gain } = evaluerPari({ ...p, jambes });
    modifies.push({
      ...p,
      jambes,
      statut,
      ...(statut !== "en_cours" ? { gain, regleLe: new Date(maintenant).toISOString(), auto: true } : {}),
    });
  }
  return modifies;
}
