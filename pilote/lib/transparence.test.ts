import { describe, expect, it } from "vitest";
import { etatInitial } from "./store";
import type { EtatApp, Pari } from "./types";
import { chainer, differences, sceller, verifierChaine } from "./transparence";

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

  it("scelle un pari jusqu'au coup d'envoi, puis le révèle tel quel", async () => {
    const j = await chainer(await chainer([], differences(null, etat(), T), T), differences(etat(), etat([pari()]), T), T);
    const avant = sceller(j, Date.parse("2026-11-17T14:00:00Z"));
    expect(avant[1].d).toBeUndefined();
    expect(avant[1].apercu).toEqual({ mode: "classique", mise: 10, commence: "2026-11-17T15:00:00.000Z" });
    expect(await verifierChaine(avant)).toBeNull(); // vérifiable même scellé
    const apres = sceller(j, Date.parse("2026-11-17T15:01:00Z"));
    expect(apres[1].d?.pari?.selections[0].label).toBe("Victoire A");
    // Un contenu révélé différent de celui scellé est détecté.
    const faux = apres.map((e) => (e.n === 2 ? { ...e, d: { ...e.d, pari: { ...e.d!.pari!, cote: 3.5 } } } : e));
    expect(await verifierChaine(faux)).toBe(2);
  });

  it("inscrit les preuves Winamax et les relevés de solde", () => {
    const a = etat([pari()]);
    const b = { ...etat([pari({ preuve: { numero: "WX-123", empreinte: "abc", ajouteeLe: "2026-11-17T12:00:00Z" } })]), releves: [{ id: "r1", date: "2026-11-30T20:00:00Z", soldeWinamax: 512, soldePilote: 510 }] };
    const ev = differences(a, b, T);
    expect(ev.map((e) => e.type)).toEqual(["preuve_ajoutee", "releve_solde"]);
    expect(ev[0].d.pari?.preuve?.numero).toBe("WX-123");
    expect(ev[1].d.releve?.ecart).toBe(2);
  });
});
