import { describe, expect, it } from "vitest";
import type { Pari } from "./types";
import { controler, correspondance, messageParDefaut, titreBilan, type LectureCapture, type PariLu } from "./actus";

const lu = (o: Partial<PariLu> = {}): PariLu => ({ selection: "Lens", match: "Lens - Lille", cote: 2.3, mise: 10, gain: 23, statut: "gagne", numeroTicket: null, date: null, ...o });
const lecture = (paris: PariLu[], confiance = 95): LectureCapture => ({ type: "historique", paris, solde: null, confiance, remarques: "", message: "", modele: "test" });
const pari = (o: Partial<Pari> = {}): Pari => ({
  id: "p1",
  creeLe: "2026-11-17T10:00:00Z",
  mode: "classique",
  cote: 2.3,
  mise: 10,
  confiance: 85,
  edge: 0.05,
  probaEstimee: 0.47,
  statut: "gagne",
  gain: 23,
  jambes: [{ selectionId: "s", eventId: "e", sportKey: "soccer_france_ligue_one", sportTitle: "Ligue 1", commence: "", home: "Lens", away: "Lille", market: "h2h", issue: "Lens", label: "Victoire Lens", odds: 2.3, fairProb: 0.47, statut: "gagne" }],
  ...o,
});

describe("lecture des captures", () => {
  it("calcule le bilan et autorise la publication automatique quand tout est cohérent", () => {
    const r = controler(lecture([lu(), lu({ selection: "Plus de 2,5 buts", match: "PSG - OM", cote: 1.9, mise: 20, gain: 0, statut: "perdu" })]), []);
    expect(r.bilan).toEqual({ gagnes: 1, perdus: 1, enCours: 0, mises: 30, net: -7 });
    expect(r.sure).toBe(true);
    expect(titreBilan(r.bilan)).toContain("−7,00");
    expect(messageParDefaut(r)).toMatch(/perdu \(−20,00\s€\)/u); // espace insécable avant €
  });

  it("demande une relecture si un chiffre est incohérent, illisible ou la lecture incertaine", () => {
    expect(controler(lecture([lu({ gain: 40 })]), []).sure).toBe(false); // 40 ≠ 10 × 2,3
    expect(controler(lecture([lu({ mise: null })]), []).raisons.join()).toContain("Mise illisible");
    expect(controler(lecture([lu()], 60), []).raisons.join()).toContain("Lecture incertaine");
    expect(controler(lecture([lu({ statut: "en_cours", gain: null })]), []).sure).toBe(false);
    expect(controler(lecture([]), []).sure).toBe(false);
  });

  it("retrouve le pari dans le journal du compte (numéro de ticket ou sélection + cote + mise)", () => {
    expect(correspondance(lu(), [pari()])?.pariId).toBe("p1");
    expect(correspondance(lu({ cote: 2.6 }), [pari()])).toBeUndefined();
    expect(correspondance(lu({ selection: "Toulouse", match: "Toulouse - Nice" }), [pari()])).toBeUndefined();
    expect(correspondance(lu({ numeroTicket: "WX 123", selection: "?" }), [pari({ preuve: { numero: "WX123", ajouteeLe: "" } })])?.pariId).toBe("p1");
    expect(correspondance(lu(), [pari({ demo: true })])).toBeUndefined();
  });
});
