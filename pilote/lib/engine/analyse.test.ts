import { describe, expect, it } from "vitest";
import type { Pari } from "../types";
import { chance, clvGlobal, clvPari, extremes, parCote, parIndice, parMois, parSport, plusGrosseBaisse, series, simulerSuivi } from "./analyse";

let n = 0;
const pari = (o: Partial<Pari> & { profit?: number } = {}): Pari => {
  n++;
  const mise = o.mise ?? 10;
  const cote = o.cote ?? 2;
  const statut = o.statut ?? (o.profit !== undefined ? (o.profit > 0 ? "gagne" : "perdu") : "gagne");
  return {
    id: `p${n}`,
    creeLe: o.creeLe ?? `2026-11-${String(n).padStart(2, "0")}T10:00:00Z`,
    regleLe: o.regleLe ?? `2026-11-${String(n).padStart(2, "0")}T20:00:00Z`,
    mode: "classique",
    cote,
    mise,
    confiance: 75,
    edge: 0.05,
    probaEstimee: 0.5,
    statut,
    gain: statut === "gagne" ? mise * cote : statut === "rembourse" ? mise : 0,
    jambes: [{ selectionId: `s${n}`, eventId: `e${n}`, sportKey: "soccer_epl", sportTitle: "EPL", commence: "", home: "A", away: "B", market: "h2h", issue: "A", label: "Victoire A", odds: cote, fairProb: 0.5, statut: "gagne" }],
    ...o,
  };
};

describe("statistiques fines", () => {
  const ps = [pari({ statut: "gagne" }), pari({ statut: "perdu" }), pari({ statut: "perdu" }), pari({ statut: "perdu", regleLe: "2026-10-30T20:00:00Z" }), pari({ statut: "gagne", cote: 5.5 })];

  it("regroupe par mois, sport, tranche de cote et d'indice", () => {
    const mois = parMois(ps, "Europe/Paris");
    expect(mois.map((m) => m.libelle)).toEqual(["novembre 2026", "octobre 2026"]);
    expect(mois[0].paris).toBe(4);
    expect(parSport(ps)[0].libelle).toBe("Premier League");
    const cotes = parCote(ps);
    expect(cotes.map((c) => c.libelle)).toEqual(["2 à 3", "5 et plus"]);
    expect(parIndice(ps)[0].libelle).toBe("indice 70 à 80");
  });

  it("mesure les séries, la plus grosse baisse et les extrêmes", () => {
    const s = series([pari({ statut: "gagne" }), pari({ statut: "perdu" }), pari({ statut: "perdu" }), pari({ statut: "perdu" }), pari({ statut: "gagne" })]);
    expect(s.pertesMax).toBe(3);
    expect(s.gainsMax).toBe(1);
    expect(s.enCours).toEqual({ type: "gagne", n: 1 });
    const b = plusGrosseBaisse([pari({ statut: "gagne" }), pari({ statut: "perdu" }), pari({ statut: "perdu" }), pari({ statut: "gagne" })], 100);
    expect(b.montant).toBe(20);
    expect(b.pct).toBeCloseTo(20 / 110, 6);
    const e = extremes(ps, "Europe/Paris");
    expect(e.meilleurPari?.cote).toBe(5.5);
    expect(e.pirePari && e.pirePari.statut).toBe("perdu");
  });

  it("compare le gain attendu au gain réel", () => {
    const c = chance([pari({ statut: "perdu" }), pari({ statut: "perdu" })]);
    expect(c.attendu).toBeCloseTo(1, 6);
    expect(c.reel).toBe(-20);
    expect(c.ecart).toBeCloseTo(-21, 6);
  });
});

describe("cote de clôture", () => {
  it("calcule l'avantage par rapport au juste prix de clôture", () => {
    const p = pari({ cote: 2.1 });
    expect(clvPari(p, {})).toBeNull();
    const clotures = { [p.jambes[0].selectionId]: { cote: 1.95, probaJuste: 0.5, releveLe: "" } };
    expect(clvPari(p, clotures)).toBeCloseTo(0.05, 6);
    const g = clvGlobal([p, pari()], clotures);
    expect(g.n).toBe(1);
    expect(g.part).toBe(1);
  });
});

describe("simulateur « si tu avais suivi »", () => {
  it("mise la même part de bankroll et ignore les dépôts du compte suivi", () => {
    // Compte de 500 € : mise 50 € (10 %) gagnée à 2, puis dépôt de 500 €, puis mise 110 € (10 %) perdue.
    const a = pari({ mise: 50, cote: 2, statut: "gagne", creeLe: "2026-11-02T10:00:00Z", regleLe: "2026-11-02T20:00:00Z" });
    const b = pari({ mise: 110, cote: 2, statut: "perdu", creeLe: "2026-11-04T10:00:00Z", regleLe: "2026-11-04T20:00:00Z" });
    const sim = simulerSuivi({
      paris: [a, b],
      mouvements: [{ id: "m", date: "2026-11-03T00:00:00Z", type: "depot", montant: 500 }],
      bankrollInitiale: 500,
      dateDebut: "2026-11-01T00:00:00Z",
      capital: 100,
      modes: ["classique"],
    });
    // Suiveur : 100 → +10 (10 % gagné) = 110 → mise 110/1050 × 110 ≈ 11,52 perdue → 98,48
    expect(sim.paris).toBe(2);
    expect(sim.final).toBeCloseTo(110 - (110 / 1050) * 110, 6);
    expect(sim.courbe).toHaveLength(3);
  });
});
