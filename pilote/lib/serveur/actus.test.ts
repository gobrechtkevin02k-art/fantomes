import { describe, expect, it, vi } from "vitest";
vi.mock("./stockage", () => ({ stockage: () => ({ get: async () => null, set: async () => {}, membres: async () => [] }) }));
vi.mock("./push", () => ({ envoyer: async () => 0 }));
vi.mock("./abonnements", () => ({ offreDe: async () => ({ offre: "pro" }) }));
import { etatInitial } from "../store";
import { bilanDuJour } from "./actus";

describe("bilan du jour automatique", () => {
  const e = etatInitial();
  e.reglages.bankrollInitiale = 500;
  e.paris = [
    { id: "a", creeLe: "2026-11-17T10:00:00Z", regleLe: "2026-11-17T21:00:00Z", mode: "classique", cote: 2, mise: 10, confiance: 80, edge: 0.04, probaEstimee: 0.5, statut: "gagne", gain: 20, jambes: [{ selectionId: "s", eventId: "e", sportKey: "soccer_epl", sportTitle: "", commence: "", home: "A", away: "B", market: "h2h", issue: "A", label: "Victoire A", odds: 2, fairProb: 0.5, statut: "gagne" }] },
    { id: "b", creeLe: "2026-11-17T10:00:00Z", regleLe: "2026-11-17T21:30:00Z", mode: "classique", cote: 1.8, mise: 5, confiance: 80, edge: 0.04, probaEstimee: 0.5, statut: "perdu", gain: 0, jambes: [] },
    { id: "c", creeLe: "2026-11-16T10:00:00Z", regleLe: "2026-11-16T21:30:00Z", mode: "classique", cote: 1.8, mise: 50, confiance: 80, edge: 0.04, probaEstimee: 0.5, statut: "perdu", gain: 0, jambes: [] },
  ];
  it("résume les paris réglés de la journée après 22 h, pertes comprises", () => {
    expect(bilanDuJour(e, Date.parse("2026-11-17T19:00:00Z"))).toBeNull(); // 20 h à Paris
    const a = bilanDuJour(e, Date.parse("2026-11-17T21:30:00Z"))!;
    expect(a.id).toBe("bilan-2026-11-17");
    expect(a.bilan).toEqual({ gagnes: 1, perdus: 1, enCours: 0, mises: 15, net: 5 });
    expect(a.titre).toContain("+5,00");
    expect(a.texte).toContain("Victoire A");
    expect(a.texte).toContain("−5,00");
  });
});
