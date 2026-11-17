import { describe, expect, it } from "vitest";
import { etatInitial } from "./store";
import type { EtatApp, Pari } from "./types";
import { chainer, differences, verifierChaine } from "./transparence";

const T = Date.parse("2026-11-17T12:00:00Z");

function etat(paris: Pari[] = [], mouvements: EtatApp["mouvements"] = []): EtatApp {
  const e = etatInitial();
  return { ...e, onboarding: true, reglages: { ...e.reglages, bankrollInitiale: 500, dateDebut: "2026-11-01T00:00:00Z" }, paris, mouvements };
}

const pari = (o: Partial<Pari> = {}): Pari => ({
  id: "p1",
  creeLe: "2026-11-17T11:00:00Z",
  mode: "classique",
  cote: 2.1,
  mise: 10,
  confiance: 82,
  edge: 0.04,
  probaEstimee: 0.5,
  statut: "en_cours",
  jambes: [{ selectionId: "s", eventId: "e", sportKey: "soccer_epl", sportTitle: "EPL", commence: "2026-11-17T15:00:00Z", home: "A", away: "B", market: "h2h", issue: "A", label: "Victoire A", odds: 2.1, fairProb: 0.5, statut: "en_cours" }],
  ...o,
});

describe("journal de transparence", () => {
  it("ouvre le journal avec le premier dépôt et l'historique existant", () => {
    const ev = differences(null, etat([pari({ statut: "gagne", gain: 21 })], [{ id: "m1", date: "2026-11-05T00:00:00Z", type: "depot", montant: 100 }]), T);
    expect(ev.map((e) => e.type)).toEqual(["ouverture", "depot", "pari_place", "pari_regle"]);
    expect(ev[0].d.bankrollInitiale).toBe(500);
    expect(ev.slice(1).every((e) => e.d.anterieur)).toBe(true);
  });

  it("enregistre dépôts, retraits, résultats, corrections et suppressions", () => {
    const a = etat([pari()]);
    const b = etat([pari({ statut: "perdu", gain: 0, regleLe: "2026-11-17T17:00:00Z", auto: true })], [
      { id: "m2", date: "2026-11-17T18:00:00Z", type: "retrait", montant: -150 },
      { id: "m3", date: "2026-11-17T18:05:00Z", type: "depot", montant: 200 },
    ]);
    expect(differences(a, b, T).map((e) => e.type)).toEqual(["retrait", "depot", "pari_regle"]);
    const c = etat([pari({ statut: "gagne", gain: 21 })], b.mouvements);
    expect(differences(b, c, T).map((e) => e.type)).toEqual(["pari_corrige"]);
    const d = etat([], [b.mouvements[1]]);
    expect(differences(c, d, T).map((e) => e.type)).toEqual(["mouvement_supprime", "pari_supprime"]);
  });

  it("signale un pari enregistré après le coup d'envoi et ignore les paris de démo", () => {
    const tard = differences(etat(), etat([pari()]), Date.parse("2026-11-17T15:30:00Z"));
    expect(tard[0].d.apresDebut).toBe(true);
    expect(differences(etat(), etat([pari({ demo: true })]), T)).toHaveLength(0);
  });

  it("chaîne les entrées et détecte toute retouche", async () => {
    const j1 = await chainer([], differences(null, etat(), T), T);
    const j2 = await chainer(j1, differences(etat(), etat([pari()]), T + 1000), T + 1000);
    expect(j2).toHaveLength(2);
    expect(j2[1].precedent).toBe(j2[0].hash);
    expect(await verifierChaine(j2)).toBeNull();
    const triche = j2.map((e) => ({ ...e, d: { ...e.d } }));
    triche[0].d.bankrollInitiale = 5000;
    expect(await verifierChaine(triche)).toBe(1);
    expect(await verifierChaine([j2[1]])).toBe(2); // entrée supprimée en tête de chaîne
  });
});
