import { describe, expect, it } from "vitest";
import type { Jambe, Pari, ScoreEvent } from "../types";
import { evaluerPariDirect, minuteFoot, probaBasketEnDirect, probaFootEnDirect } from "./direct";

const T0 = Date.parse("2026-11-17T20:00:00Z");
const jambe = (j: Partial<Jambe> = {}): Jambe => ({
  selectionId: "e1|h2h|Lens",
  eventId: "e1",
  sportKey: "soccer_france_ligue_one",
  sportTitle: "Ligue 1",
  commence: new Date(T0).toISOString(),
  home: "Lens",
  away: "Lille",
  market: "h2h",
  issue: "Lens",
  label: "Victoire Lens",
  odds: 2.2,
  fairProb: 0.45,
  statut: "en_cours",
  ...j,
});

describe("probabilités en direct (football)", () => {
  it("retrouve la probabilité d'avant-match au coup d'envoi", () => {
    expect(probaFootEnDirect(jambe(), 0, 0, 0)).toBeCloseTo(0.45, 2);
    expect(probaFootEnDirect(jambe({ market: "totals", issue: "Over", point: 2.5, fairProb: 0.55 }), 0, 0, 0)).toBeCloseTo(0.55, 2);
  });
  it("réagit au score et au temps", () => {
    const mene = probaFootEnDirect(jambe(), 1, 0, 80)!;
    const perd = probaFootEnDirect(jambe(), 0, 1, 80)!;
    expect(mene).toBeGreaterThan(0.85);
    expect(perd).toBeLessThan(0.1);
    expect(probaFootEnDirect(jambe({ market: "totals", issue: "Over", point: 2.5, fairProb: 0.55 }), 2, 1, 30)).toBeCloseTo(1, 6);
  });
  it("estime la minute avec la mi-temps", () => {
    expect(minuteFoot(new Date(T0).toISOString(), T0 + 30 * 60_000)).toBe(30);
    expect(minuteFoot(new Date(T0).toISOString(), T0 + 55 * 60_000)).toBe(45);
    expect(minuteFoot(new Date(T0).toISOString(), T0 + 100 * 60_000)).toBe(85);
  });
});

describe("probabilités en direct (basket)", () => {
  it("une équipe qui mène largement en fin de match gagne presque sûrement", () => {
    const j = jambe({ sportKey: "basketball_nba", fairProb: 0.5 });
    expect(probaBasketEnDirect(j, 0, 0, j.commence, T0)).toBeCloseTo(0.5, 2);
    expect(probaBasketEnDirect(j, 110, 95, j.commence, T0 + 140 * 60_000)!).toBeGreaterThan(0.95);
  });
});

describe("conseil de cash-out", () => {
  const pari = (j: Partial<Jambe> = {}, mise = 20): Pari => ({
    id: "p1",
    creeLe: new Date(T0 - 3_600_000).toISOString(),
    mode: "classique",
    jambes: [jambe(j)],
    cote: 2.2,
    mise,
    confiance: 80,
    edge: 0.05,
    probaEstimee: 0.45,
    statut: "en_cours",
  });
  const score = (h: number, a: number): ScoreEvent[] => [
    { id: "e1", sportKey: "soccer_france_ligue_one", commence: new Date(T0).toISOString(), completed: false, home: "Lens", away: "Lille", scores: [{ name: "Lens", score: h }, { name: "Lille", score: a }] },
  ];

  it("propose de sécuriser un gros gain bien parti, avec un seuil de cash-out", () => {
    const e = evaluerPariDirect(pari(), score(2, 0), [], T0 + 95 * 60_000, 500)!;
    expect(e.conseil).toBe("securiser");
    expect(e.seuilCashout).toBeGreaterThan(30);
    expect(e.seuilCashout!).toBeLessThan(44);
    expect(e.message).toContain("cash-out");
  });

  it("propose de limiter la casse sans vendre sous la valeur juste", () => {
    const e = evaluerPariDirect(pari(), score(0, 1), [], T0 + 85 * 60_000, 500)!;
    expect(e.conseil).toBe("limiter");
    expect(e.seuilCashout).toBeCloseTo(e.valeurJuste, 1);
    expect(e.message).toContain("perdre deux fois");
  });

  it("ne propose pas de cash-out quand il n'y a plus rien à récupérer", () => {
    const e = evaluerPariDirect(pari(), score(0, 3), [], T0 + 105 * 60_000, 500)!;
    expect(e.conseil).toBe("garder");
    expect(e.message).toContain("miracle");
  });

  it("ne dit rien quand rien ne presse, et ignore les matchs pas encore commencés", () => {
    expect(evaluerPariDirect(pari(), score(0, 0), [], T0 + 20 * 60_000, 500)!.conseil).toBe("garder");
    expect(evaluerPariDirect(pari(), [], [], T0 - 60_000, 500)).toBeNull();
  });

  it("préfère les cotes en direct au modèle", () => {
    const events = [
      {
        id: "e1",
        sportKey: "soccer_france_ligue_one",
        sportTitle: "Ligue 1",
        commence: new Date(T0).toISOString(),
        home: "Lens",
        away: "Lille",
        bookmakers: [{ key: "pinnacle", title: "Pinnacle", markets: [{ key: "h2h" as const, outcomes: [{ name: "Lens", price: 1.1 }, { name: "Draw", price: 9 }, { name: "Lille", price: 30 }] }] }],
      },
    ];
    const e = evaluerPariDirect(pari(), score(1, 0), events, T0 + 70 * 60_000, 500)!;
    expect(e.jambes[0].source).toBe("cotes");
    expect(e.pLive).toBeGreaterThan(0.85);
  });
});
