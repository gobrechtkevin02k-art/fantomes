import { describe, expect, it } from "vitest";
import type { Pari, Reglages, Selection, SportEvent } from "../types";
import { calculerBankroll, projection, protections, statistiques } from "./bankroll";
import { evaluerCombo, meilleursCombosParTaille, proposerCombos } from "./combos";
import { arrondir, kelly, miseClassique, miseJackpot, miseObjectif, type ContexteMise } from "./mise";
import { devigMultiplicatif, devigPuissance, marge, phi } from "./proba";
import { evaluerPari, reglerJambe } from "./reglement";
import { construireSelections, indiceConfiance, probaAjustee } from "./valeur";

const MAINTENANT = Date.parse("2026-11-17T12:00:00Z");

const reglages = (r: Partial<Reglages> = {}): Reglages => ({
  bankrollInitiale: 1000,
  dateDebut: "2026-11-01T00:00:00Z",
  allocation: { classique: 80, objectif: 15, jackpot: 5 },
  profil: "equilibre",
  objectif: null,
  stopLossJour: 10,
  stopLossSemaine: 20,
  expositionMax: 15,
  miseMin: 0.1,
  arrondi: 0.1,
  sports: [],
  marches: ["h2h", "totals"],
  classique: { coteMin: 1.3, coteMax: 3, confianceMin: 60, edgeMin: 0.01 },
  objectifCote: { cible: 10, horizonJours: 7, jambesMax: 8, coteJambeMax: 3.5, confianceMin: 45 },
  jackpot: { coteMin: 20, cibleCombo: 100, misePct: 2 },
  pause: null,
  ...r,
});

function evenement(id: string, cotes: Record<string, [number, number, number]>, heures = 24): SportEvent {
  return {
    id,
    sportKey: "soccer_france_ligue_one",
    sportTitle: "Ligue 1",
    commence: new Date(MAINTENANT + heures * 3_600_000).toISOString(),
    home: "Paris Saint Germain",
    away: "Marseille",
    bookmakers: Object.entries(cotes).map(([key, [h, d, a]]) => ({
      key,
      title: key,
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "Paris Saint Germain", price: h },
            { name: "Draw", price: d },
            { name: "Marseille", price: a },
          ],
        },
      ],
    })),
  };
}

describe("probabilités", () => {
  it("retire la marge (méthode proportionnelle et puissance)", () => {
    const cotes = [1.9, 3.6, 4.2];
    expect(marge(cotes)).toBeGreaterThan(0);
    for (const f of [devigMultiplicatif, devigPuissance]) {
      const p = f(cotes);
      expect(p.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 9);
      expect(p[0]).toBeGreaterThan(p[2]);
    }
    // La méthode puissance retire davantage de marge sur l'outsider que sur le favori.
    const m = devigMultiplicatif(cotes);
    const pw = devigPuissance(cotes);
    expect(pw[0]).toBeGreaterThan(m[0]);
    expect(pw[2]).toBeLessThan(m[2]);
  });

  it("loi normale", () => {
    expect(phi(0)).toBeCloseTo(0.5, 6);
    expect(phi(1.96)).toBeCloseTo(0.975, 3);
    expect(phi(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe("détection de valeur", () => {
  it("repère une cote Winamax au-dessus du consensus", () => {
    const ev = evenement("e1", {
      pinnacle: [2.0, 3.6, 4.1],
      betfair_ex_eu: [2.02, 3.65, 4.2],
      betclic_fr: [1.92, 3.4, 3.9],
      unibet_fr: [1.95, 3.45, 3.95],
      winamax_fr: [2.2, 3.3, 3.7],
    });
    const sels = construireSelections([ev], { maintenant: MAINTENANT });
    expect(sels).toHaveLength(3);
    const psg = sels.find((s) => s.issue === "Paris Saint Germain") as Selection;
    expect(psg.edge).toBeGreaterThan(0.05);
    expect(psg.confidence).toBeGreaterThan(85);
    expect(psg.label).toBe("Victoire Paris Saint Germain");
    const nul = sels.find((s) => s.issue === "Draw") as Selection;
    expect(nul.edge).toBeLessThan(0);
    expect(nul.confidence).toBeLessThan(50);
    expect(nul.label).toBe("Match nul");
  });

  it("ignore les matchs commencés et ceux sans référence externe", () => {
    const passe = evenement("e2", { pinnacle: [2, 3.5, 4], winamax_fr: [2.1, 3.4, 3.8] }, -1);
    const seul = evenement("e3", { winamax_fr: [2.1, 3.4, 3.8] });
    expect(construireSelections([passe, seul], { maintenant: MAINTENANT })).toHaveLength(0);
  });

  it("signale une cote anormale et plafonne sa confiance", () => {
    const ev = evenement("e4", { pinnacle: [2.0, 3.6, 4.1], betfair_ex_eu: [2.0, 3.6, 4.1], winamax_fr: [3.5, 3.3, 3.7] });
    const psg = construireSelections([ev], { maintenant: MAINTENANT }).find((s) => s.issue === "Paris Saint Germain") as Selection;
    expect(psg.suspect).toBe(true);
    expect(psg.confidence).toBeLessThanOrEqual(50);
  });

  it("la confiance croît avec l'avantage et décroît avec l'incertitude", () => {
    expect(indiceConfiance(0.5, 2.0, 0.06)).toBeCloseTo(50, 1);
    expect(indiceConfiance(0.52, 2.0, 0.06)).toBeGreaterThan(indiceConfiance(0.51, 2.0, 0.06));
    expect(indiceConfiance(0.52, 2.0, 0.06)).toBeGreaterThan(indiceConfiance(0.52, 2.0, 0.15));
  });

  it("la probabilité ajustée réduit l'avantage selon la confiance", () => {
    const base = { fairProb: 0.55, impliedProb: 0.5, edge: 0.1 };
    expect(probaAjustee({ ...base, confidence: 50 })).toBeCloseTo(0.5, 9);
    expect(probaAjustee({ ...base, confidence: 100 })).toBeCloseTo(0.55, 9);
    expect(probaAjustee({ ...base, confidence: 75 })).toBeCloseTo(0.525, 9);
  });
});

function ctx(r = reglages(), extra: Partial<ContexteMise["protections"]> = {}): ContexteMise {
  const bk = calculerBankroll({ reglages: r, paris: [], mouvements: [] });
  return { reglages: r, poches: bk.poches, total: bk.total, protections: { ...protections(r, [], bk, MAINTENANT), ...extra } };
}

const selection = (s: Partial<Selection> = {}): Selection => ({
  id: "x|h2h|A",
  eventId: "x",
  sportKey: "soccer_epl",
  sportTitle: "EPL",
  commence: new Date(MAINTENANT + 20 * 3_600_000).toISOString(),
  home: "A",
  away: "B",
  market: "h2h",
  ligne: "h2h",
  issue: "A",
  label: "Victoire A",
  odds: 2.1,
  fairProb: 0.5,
  fairOdds: 2,
  impliedProb: 1 / 2.1,
  edge: 0.05,
  sigma: 0.06,
  confidence: 90,
  facteurs: { marche: 100, accord: 90, delai: 100, niveau: 100 },
  books: 5,
  sharp: true,
  suspect: false,
  ...s,
});

describe("mises", () => {
  it("Kelly et arrondi", () => {
    expect(kelly(0.5, 2)).toBe(0);
    expect(kelly(0.55, 2)).toBeCloseTo(0.1, 9);
    expect(kelly(0.4, 2)).toBe(0);
    expect(arrondir(3.47, 0.1)).toBe(3.4);
    expect(arrondir(-1, 0.1)).toBe(0);
  });

  it("mise classique : proportionnelle, plafonnée, et nulle sans avantage", () => {
    const c = ctx();
    const r = miseClassique(selection(), c);
    expect(r.mise).toBeGreaterThan(0);
    expect(r.mise).toBeLessThanOrEqual(1000 * 0.03);
    const faible = miseClassique(selection({ confidence: 50 }), c);
    expect(faible.mise).toBe(0);
    const prudent = miseClassique(selection(), ctx(reglages({ profil: "prudent" })));
    expect(prudent.mise).toBeLessThan(r.mise);
  });

  it("le mode prudence divise la mise par deux", () => {
    const normal = miseClassique(selection(), ctx());
    const prud = miseClassique(selection(), ctx(reglages(), { prudence: true }));
    expect(prud.mise).toBeLessThanOrEqual(normal.mise / 2 + 0.1);
  });

  it("le stop-loss bloque toute mise", () => {
    const r = miseClassique(selection(), ctx(reglages(), { bloque: true, raisons: ["Limite de perte du jour atteinte : reprise demain."] }));
    expect(r.mise).toBe(0);
    expect(r.bloque).toBe(true);
  });

  it("mises Objectif et Jackpot restent petites", () => {
    const c = ctx();
    const o = miseObjectif(70, c);
    expect(o.mise).toBeGreaterThan(0);
    expect(o.mise).toBeLessThanOrEqual(20);
    const j = miseJackpot(30, c);
    expect(j.mise).toBeGreaterThanOrEqual(0.1);
    expect(j.mise).toBeLessThanOrEqual(5);
  });
});

describe("combinés", () => {
  const pool: Selection[] = [];
  for (let i = 0; i < 12; i++) {
    const odds = 1.4 + (i % 4) * 0.3;
    const fair = (1 / odds) * (1 + 0.02 * (i % 3));
    pool.push(selection({ id: `m${i}|h2h|A`, eventId: `m${i}`, odds, fairProb: fair, impliedProb: 1 / odds, edge: fair * odds - 1, confidence: 60 + i }));
    // Deuxième issue sur le même match, pour vérifier la contrainte « une sélection par match ».
    pool.push(selection({ id: `m${i}|h2h|B`, eventId: `m${i}`, issue: "B", odds: 3, fairProb: 0.3, impliedProb: 1 / 3, edge: -0.1, confidence: 20 }));
  }

  it("atteint la cote cible avec au plus une sélection par match", () => {
    const res = meilleursCombosParTaille(pool, 10, 8);
    const trouves = res.filter(Boolean) as Selection[][];
    expect(trouves.length).toBeGreaterThan(0);
    for (const jambes of trouves) {
      const c = evaluerCombo(jambes);
      expect(c.cote).toBeGreaterThanOrEqual(10);
      expect(new Set(jambes.map((j) => j.eventId)).size).toBe(jambes.length);
    }
  });

  it("le plus sûr maximise la probabilité (comparaison à une recherche exhaustive)", () => {
    const petit = pool.filter((s) => s.issue === "A").slice(0, 8);
    let meilleur = 0;
    for (let mask = 1; mask < 1 << petit.length; mask++) {
      const js = petit.filter((_, i) => mask & (1 << i));
      const c = evaluerCombo(js);
      if (c.cote >= 6 && c.probaAjustee > meilleur) meilleur = c.probaAjustee;
    }
    const props = proposerCombos(petit, 6, 8);
    expect(props[0].titre).toBe("Le plus sûr");
    expect(props[0].probaAjustee).toBeCloseTo(meilleur, 2);
  });

  it("ne propose rien si la cible est inatteignable", () => {
    expect(proposerCombos(pool.slice(0, 2), 1e9, 2)).toHaveLength(0);
  });
});

describe("règlement", () => {
  const jambe = {
    selectionId: "e|h2h|A",
    eventId: "e",
    sportKey: "soccer_epl",
    sportTitle: "EPL",
    commence: "2026-11-16T15:00:00Z",
    home: "A",
    away: "B",
    market: "h2h" as const,
    issue: "A",
    label: "Victoire A",
    odds: 2,
    fairProb: 0.5,
    statut: "en_cours" as const,
  };
  const score = (h: number, a: number) => ({ id: "e", sportKey: "soccer_epl", commence: "", completed: true, home: "A", away: "B", scores: [{ name: "A", score: h }, { name: "B", score: a }] });

  it("règle 1N2, plus/moins et handicap", () => {
    expect(reglerJambe(jambe, score(2, 1))).toBe("gagne");
    expect(reglerJambe({ ...jambe, issue: "Draw" }, score(1, 1))).toBe("gagne");
    expect(reglerJambe({ ...jambe, issue: "B" }, score(2, 1))).toBe("perdu");
    expect(reglerJambe({ ...jambe, market: "totals", issue: "Over", point: 2.5 }, score(2, 1))).toBe("gagne");
    expect(reglerJambe({ ...jambe, market: "totals", issue: "Under", point: 3 }, score(2, 1))).toBe("rembourse");
    expect(reglerJambe({ ...jambe, market: "spreads", issue: "A", point: -1.5 }, score(2, 1))).toBe("perdu");
    expect(reglerJambe(jambe, { ...score(0, 0), completed: false })).toBe("en_cours");
  });

  it("calcule le gain d'un combiné avec une jambe remboursée", () => {
    const p = { mise: 10, cote: 6, jambes: [{ ...jambe, odds: 2, statut: "gagne" as const }, { ...jambe, odds: 3, statut: "rembourse" as const }] };
    expect(evaluerPari(p)).toEqual({ statut: "gagne", gain: 20 });
    expect(evaluerPari({ ...p, jambes: [p.jambes[0], { ...p.jambes[1], statut: "perdu" as const }] }).statut).toBe("perdu");
  });
});

describe("bankroll", () => {
  const pari = (o: Partial<Pari>): Pari => ({
    id: Math.random().toString(36),
    creeLe: "2026-11-10T10:00:00Z",
    mode: "classique",
    jambes: [],
    cote: 2,
    mise: 20,
    confiance: 70,
    edge: 0.03,
    probaEstimee: 0.51,
    statut: "en_cours",
    ...o,
  });

  it("répartit la bankroll en poches et suit les paris", () => {
    const r = reglages();
    const paris = [
      pari({ statut: "gagne", gain: 40, regleLe: "2026-11-10T20:00:00Z" }),
      pari({ mode: "jackpot", mise: 1, cote: 50, statut: "perdu", gain: 0, regleLe: "2026-11-11T20:00:00Z" }),
      pari({ mode: "objectif", mise: 5, creeLe: "2026-11-12T10:00:00Z" }),
    ];
    const bk = calculerBankroll({ reglages: r, paris, mouvements: [] });
    expect(bk.poches.classique).toBeCloseTo(820, 6);
    expect(bk.poches.jackpot).toBeCloseTo(49, 6);
    expect(bk.poches.objectif).toBeCloseTo(145, 6);
    expect(bk.engageTotal).toBe(5);
    expect(bk.total).toBeCloseTo(1019, 6);
    const st = statistiques(paris);
    expect(st.profit).toBeCloseTo(19, 6);
    expect(st.enCours).toBe(1);
  });

  it("dépôts, retraits et rééquilibrage", () => {
    const r = reglages();
    const bk = calculerBankroll({
      reglages: r,
      paris: [pari({ mode: "jackpot", mise: 50, statut: "perdu", gain: 0, regleLe: "2026-11-05T20:00:00Z", creeLe: "2026-11-05T10:00:00Z" })],
      mouvements: [
        { id: "1", date: "2026-11-06T00:00:00Z", type: "depot", montant: 100 },
        { id: "2", date: "2026-11-07T00:00:00Z", type: "reequilibrage", montant: 0 },
      ],
    });
    expect(bk.total).toBeCloseTo(1050, 6);
    expect(bk.poches.jackpot).toBeCloseTo(1050 * 0.05, 6);
    expect(bk.apports).toBe(1100);
  });

  it("déclenche le stop-loss du jour", () => {
    const r = reglages({ stopLossJour: 5 });
    const paris = [pari({ mise: 60, statut: "perdu", gain: 0, creeLe: "2026-11-17T08:00:00Z", regleLe: "2026-11-17T11:00:00Z" })];
    const bk = calculerBankroll({ reglages: r, paris, mouvements: [] });
    const pr = protections(r, paris, bk, MAINTENANT);
    expect(pr.stopJour).toBe(true);
    expect(pr.bloque).toBe(true);
  });

  it("projection vers l'objectif", () => {
    const r = reglages({ objectif: { montant: 2000, date: "2027-11-17T00:00:00Z" } });
    const bk = calculerBankroll({ reglages: r, paris: [], mouvements: [] });
    const pj = projection(r, [], bk, MAINTENANT);
    expect(pj.statut).toBe("indetermine");
    expect(pj.croissanceRequise).toBeGreaterThan(0.05);
    expect(pj.croissanceRequise).toBeLessThan(0.07);
    expect(pj.ambitieux).toBe(false);
  });
});
