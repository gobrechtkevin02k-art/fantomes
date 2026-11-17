import { describe, expect, it } from "vitest";
import type { AnalyseIA, Pari, Reglages, Selection } from "../types";
import { calculerBankroll, protections } from "./bankroll";
import { avisSelection, planDuJour, recapDepuis } from "./conseiller";
import { miseClassique, type ContexteMise } from "./mise";
import { aHeure, cleJour, debutJour, hhmm, jourRelatif, parties } from "./temps";

// Mardi 17 novembre 2026, 12:00 à Paris (11:00 UTC).
const MAINTENANT = Date.parse("2026-11-17T11:00:00Z");
const TZ = "Europe/Paris";

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
  classique: { coteMin: 1.3, coteMax: 3.2, confianceMin: 60, edgeMin: 0.01 },
  objectifCote: { cible: 10, horizonJours: 7, jambesMax: 8, coteJambeMax: 3.5, confianceMin: 45 },
  jackpot: { coteMin: 20, cibleCombo: 100, misePct: 2 },
  pause: null,
  conseiller: { conviction: true, boostMax: 1.5, attendreCompos: true, combineDuJour: false, analyseAuto: false, modeSimple: true, heureRecap: 7, fuseau: TZ },
  ...r,
});

function ctx(r = reglages(), paris: Pari[] = []): ContexteMise {
  const bk = calculerBankroll({ reglages: r, paris, mouvements: [] });
  return { reglages: r, poches: bk.poches, total: bk.total, protections: protections(r, paris, bk, MAINTENANT) };
}

let n = 0;
const sel = (s: Partial<Selection> = {}): Selection => {
  n++;
  const odds = s.odds ?? 2.1;
  const fair = s.fairProb ?? 0.5;
  return {
    id: `e${n}|h2h|A`,
    eventId: `e${n}`,
    sportKey: "soccer_epl",
    sportTitle: "EPL",
    commence: new Date(MAINTENANT + 8 * 3_600_000).toISOString(), // 20:00 à Paris
    home: "A",
    away: "B",
    market: "h2h",
    ligne: "h2h",
    issue: "A",
    label: "Victoire A",
    odds,
    fairProb: fair,
    fairOdds: 1 / fair,
    impliedProb: 1 / odds,
    edge: fair * odds - 1,
    sigma: 0.08,
    confidence: 75,
    facteurs: { marche: 100, accord: 90, delai: 100, niveau: 100 },
    books: 5,
    sharp: true,
    suspect: false,
    ...s,
  };
};

describe("fuseau horaire", () => {
  it("calcule l'heure locale de Paris (hiver)", () => {
    const p = parties(MAINTENANT, TZ);
    expect(p.heure).toBe(12);
    expect(cleJour(MAINTENANT, TZ)).toBe("2026-11-17");
    expect(new Date(debutJour(MAINTENANT, TZ)).toISOString()).toBe("2026-11-16T23:00:00.000Z");
    expect(hhmm(aHeure(MAINTENANT, TZ, 19, 55), TZ)).toBe("19h55");
    expect(jourRelatif(MAINTENANT + 86_400_000, MAINTENANT, TZ)).toBe("demain");
  });
  it("gère l'heure d'été", () => {
    const ete = Date.parse("2026-07-01T05:00:00Z");
    expect(parties(ete, TZ).heure).toBe(7);
    expect(new Date(aHeure(ete, TZ, 7, 0)).toISOString()).toBe("2026-07-01T05:00:00.000Z");
  });
});

describe("avis du conseiller", () => {
  it("attend les compositions pour un match de foot du soir", () => {
    const s = sel({ odds: 2.06, fairProb: 0.5, confidence: 70 });
    const c = ctx();
    const a = avisSelection(s, miseClassique(s, c), c, MAINTENANT);
    expect(a.action).toBe("attendre");
    expect(a.raisonHeure).toBe("compositions");
    expect(hhmm(Date.parse(a.heure), TZ)).toBe("18h55");
    expect(a.message).toContain("compositions");
  });

  it("monte la mise au-dessus du conseil de gestion quand la cote est exceptionnelle, sans dépasser le plafond", () => {
    const s = sel({ odds: 2.3, fairProb: 0.48, confidence: 93 });
    const c = ctx();
    const base = miseClassique(s, c);
    const a = avisSelection(s, base, c, MAINTENANT);
    expect(a.mise).toBeGreaterThan(base.mise);
    expect(a.mise).toBeLessThanOrEqual(1000 * 0.03);
    expect(a.message).toContain("J'ai pris la décision de monter la mise");
    expect(a.raisonHeure).toBe("cote_genereuse");
    expect(a.action).toBe("jouer");
  });

  it("ne monte jamais la mise en mode prudence ou si l'option est coupée", () => {
    const s = sel({ odds: 2.3, fairProb: 0.48, confidence: 93 });
    const c = ctx(reglages({ conseiller: { ...reglages().conseiller, conviction: false } }));
    const base = miseClassique(s, c);
    expect(avisSelection(s, base, c, MAINTENANT).mise).toBe(base.mise);
    const c2 = ctx();
    c2.protections = { ...c2.protections, prudence: true };
    const b2 = miseClassique(s, c2);
    expect(avisSelection(s, b2, c2, MAINTENANT).mise).toBe(b2.mise);
  });

  it("suit le verdict de l'analyse IA", () => {
    const s = sel({ odds: 2.06, fairProb: 0.5, confidence: 70 });
    const c = ctx();
    const base = miseClassique(s, c);
    const ia = (verdict: AnalyseIA["verdict"]): AnalyseIA => ({
      verdict,
      resume: "Le gardien titulaire est forfait.",
      pointsForts: [],
      pointsFaibles: [],
      infosCles: [],
      avisMise: "",
      attendreCompositions: false,
      confianceAnalyste: 40,
      sources: [],
      genereLe: new Date(MAINTENANT).toISOString(),
      modele: "test",
    });
    const eviter = avisSelection(s, base, c, MAINTENANT, { analyse: ia("eviter") });
    expect(eviter.action).toBe("passer");
    expect(eviter.message).toContain("changer d'avis");
    const prudence = avisSelection(s, base, c, MAINTENANT, { analyse: ia("prudence") });
    expect(prudence.mise).toBeLessThan(base.mise);
    expect(prudence.raisonHeure).toBe("maintenant"); // compositions déjà connues selon l'analyse
  });

  it("signale une cote qui grimpe", () => {
    const s = sel({ odds: 2.2, fairProb: 0.49, confidence: 80 });
    const c = ctx();
    const a = avisSelection(s, miseClassique(s, c), c, MAINTENANT, { mouvement: { premiere: 2.05, tPremiere: new Date(MAINTENANT - 4 * 3_600_000).toISOString() } });
    expect(a.tendance).toBe("hausse");
    expect(a.message).toContain("La cote grimpe");
  });
});

describe("plan du jour", () => {
  it("regroupe les paris en sessions horaires", () => {
    const sels = [
      sel({ odds: 2.3, fairProb: 0.48, confidence: 93 }), // cote généreuse : maintenant
      sel({ odds: 2.06, fairProb: 0.5, confidence: 72 }), // compositions : 18h55
      sel({ odds: 2.06, fairProb: 0.5, confidence: 72, commence: new Date(MAINTENANT + 8.25 * 3_600_000).toISOString() }), // 19h10 → même session
      sel({ odds: 2.06, fairProb: 0.5, confidence: 72, commence: new Date(MAINTENANT + 50 * 3_600_000).toISOString() }), // dans 2 jours
    ];
    const p = planDuJour(sels, ctx(), [], MAINTENANT);
    expect(p.verdict).toBe("jouer");
    expect(p.sessions.map((s) => s.libelle)).toEqual(["Maintenant", "18h55"]);
    expect(p.sessions[1].items).toHaveLength(2);
    expect(p.plusTard).toHaveLength(1);
    expect(p.total).toBeGreaterThan(0);
    expect(p.message).toContain("après les compositions");
  });

  it("dit d'attendre demain quand rien n'est assez solide aujourd'hui", () => {
    const vide = planDuJour([sel({ odds: 1.9, fairProb: 0.5, confidence: 30 })], ctx(), [], MAINTENANT);
    expect(vide.verdict).toBe("repos");
    expect(vide.message).toContain("pas d'indice de confiance assez élevé");
    const demain = planDuJour([sel({ odds: 2.06, fairProb: 0.5, confidence: 72, commence: new Date(MAINTENANT + 40 * 3_600_000).toISOString() })], ctx(), [], MAINTENANT);
    expect(demain.verdict).toBe("attendre");
    expect(demain.message).toContain("Voyons demain");
  });

  it("respecte le stop-loss", () => {
    const r = reglages({ stopLossJour: 5 });
    const paris: Pari[] = [
      { id: "x", creeLe: "2026-11-17T08:00:00Z", regleLe: "2026-11-17T10:00:00Z", mode: "classique", jambes: [], cote: 2, mise: 60, confiance: 70, edge: 0.02, probaEstimee: 0.5, statut: "perdu", gain: 0 },
    ];
    const p = planDuJour([sel({ odds: 2.3, fairProb: 0.48, confidence: 93 })], ctx(r, paris), paris, MAINTENANT);
    expect(p.verdict).toBe("repos");
    expect(p.sessions).toHaveLength(0);
  });
});

describe("limite de l'offre", () => {
  it("garde les meilleurs paris et verrouille le reste", () => {
    const sels = [
      sel({ odds: 2.3, fairProb: 0.48, confidence: 93 }),
      sel({ odds: 2.06, fairProb: 0.5, confidence: 72 }),
      sel({ odds: 2.12, fairProb: 0.5, confidence: 80 }),
    ];
    const p = planDuJour(sels, ctx(), [], MAINTENANT, { limiteParJour: 2 });
    expect(p.sessions.flatMap((s) => s.items)).toHaveLength(2);
    expect(p.verrouilles).toHaveLength(1);
    expect(p.message).toContain("offre supérieure");
  });
  it("annonce la limite atteinte quand les paris du jour sont déjà joués", () => {
    const joue: Pari = { id: "j", creeLe: new Date(MAINTENANT - 3_600_000).toISOString(), mode: "classique", jambes: [], cote: 2, mise: 5, confiance: 80, edge: 0.03, probaEstimee: 0.5, statut: "en_cours" };
    const p = planDuJour([sel({ odds: 2.3, fairProb: 0.48, confidence: 93 })], ctx(reglages(), [joue]), [joue], MAINTENANT, { limiteParJour: 1 });
    expect(p.verdict).toBe("limite");
    expect(p.parisJoues).toBe(1);
  });
  it("sans le droit, le conseiller ne relève jamais la mise", () => {
    const s = sel({ odds: 2.3, fairProb: 0.48, confidence: 93 });
    const p = planDuJour([s], ctx(), [], MAINTENANT, { conviction: false });
    expect(p.sessions[0].items[0].boost).toBe(1);
  });
});

describe("récapitulatif", () => {
  it("résume la nuit", () => {
    const pari = (statut: Pari["statut"], gain: number): Pari => ({
      id: Math.random().toString(),
      creeLe: "2026-11-16T18:00:00Z",
      regleLe: "2026-11-16T23:30:00Z",
      mode: "classique",
      jambes: [{ selectionId: "s", eventId: "e", sportKey: "soccer_epl", sportTitle: "EPL", commence: "", home: "A", away: "B", market: "h2h", issue: "A", label: "Victoire A", odds: 2.2, fairProb: 0.5, statut: "gagne" }],
      cote: 2.2,
      mise: 10,
      confiance: 80,
      edge: 0.05,
      probaEstimee: 0.5,
      statut,
      gain,
    });
    const r = recapDepuis([pari("gagne", 22), pari("perdu", 0), pari("gagne", 22)], Date.parse("2026-11-16T19:00:00Z"), Date.parse("2026-11-17T06:30:00Z"), TZ);
    expect(r?.periode).toBe("Cette nuit");
    expect(r?.profit).toBeCloseTo(14, 6);
    expect(r?.message).toContain("2 paris gagnés sur 3");
    expect(recapDepuis([], 0, MAINTENANT, TZ)).toBeNull();
  });
});
