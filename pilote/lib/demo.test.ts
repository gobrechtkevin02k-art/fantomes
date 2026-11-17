import { describe, expect, it } from "vitest";
import { coteDemo, scoresDemo } from "./demo";
import { construireSelections } from "./engine/valeur";
import { proposerCombos } from "./engine/combos";
import { combosJackpot } from "./engine/modes";
import { etatInitial } from "./store";
import { SPORTS_PAR_DEFAUT } from "./sports";

const T = Date.parse("2026-11-17T12:00:00Z");

describe("données de démonstration", () => {
  it("produit des matchs futurs cotés et des sélections exploitables", () => {
    const evs = coteDemo(SPORTS_PAR_DEFAUT, T);
    expect(evs.length).toBeGreaterThan(30);
    expect(evs.every((e) => Date.parse(e.commence) > T)).toBe(true);
    const sels = construireSelections(evs, { maintenant: T });
    const valeur = sels.filter((s) => s.edge > 0.01 && s.confidence >= 60);
    expect(valeur.length).toBeGreaterThan(5);
    const combos = proposerCombos(sels.filter((s) => s.odds <= 3.5 && s.confidence >= 45), 10, 8);
    expect(combos.length).toBeGreaterThan(0);
    const jackpot = combosJackpot(sels, etatInitial().reglages, T);
    expect(jackpot.length).toBeGreaterThan(0);
    for (const c of jackpot) expect(c.cote).toBeGreaterThanOrEqual(100);
    // Stable d'un appel à l'autre (déterministe).
    expect(coteDemo(SPORTS_PAR_DEFAUT, T)[0]).toEqual(evs[0]);
  });

  it("donne des scores cohérents aux matchs passés", () => {
    const sc = scoresDemo(SPORTS_PAR_DEFAUT, T, 3);
    const finis = sc.filter((s) => s.completed);
    expect(finis.length).toBeGreaterThan(5);
    for (const s of finis) expect(s.scores).toHaveLength(2);
  });
});
