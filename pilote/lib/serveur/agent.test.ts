import { describe, expect, it } from "vitest";
import { coteDemo, scoresDemo } from "../demo";
import { etatInitial } from "../store";
import type { EtatApp } from "../types";
import { tacheProfil, type MetaProfil } from "./agent";

const deps = { cotes: async (s: string[]) => coteDemo(s, Date.parse("2026-11-17T06:05:00Z")), scores: async (s: string[]) => scoresDemo(s, Date.parse("2026-11-17T06:05:00Z")) };

function etat(): EtatApp {
  const e = etatInitial();
  return { ...e, onboarding: true, reglages: { ...e.reglages, bankrollInitiale: 500, conseiller: { ...e.reglages.conseiller, fuseau: "Europe/Paris" } } };
}

describe("agent autonome", () => {
  it("envoie le récap et le plan à 7h si l'appli n'a pas été ouverte, une seule fois", async () => {
    const t = Date.parse("2026-11-17T06:05:00Z"); // 7h05 à Paris
    const { notifications, meta } = await tacheProfil(etat(), { derniereOuverture: "2026-11-16T21:00:00Z" }, t, deps);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].titre).toContain("☀️");
    expect(notifications[0].texte).toMatch(/Aujourd'hui/);
    expect(meta.matinEnvoye).toBe("2026-11-17");
    expect(meta.plan?.jour).toBe("2026-11-17");
    const encore = await tacheProfil(etat(), meta, t + 15 * 60_000, deps);
    expect(encore.notifications.filter((n) => n.tag.startsWith("matin"))).toHaveLength(0);
  });

  it("ne réveille pas avant l'heure du récap et se tait si l'appli a été ouverte ce matin", async () => {
    const avant = await tacheProfil(etat(), {}, Date.parse("2026-11-17T05:30:00Z"), deps);
    expect(avant.notifications).toHaveLength(0);
    const ouvert = await tacheProfil(etat(), { derniereOuverture: "2026-11-17T05:50:00Z" }, Date.parse("2026-11-17T06:05:00Z"), deps);
    expect(ouvert.notifications).toHaveLength(0);
    expect(ouvert.meta.plan).toBeDefined();
  });

  it("prévient à l'heure de jeu avec un lien de validation en un clic", async () => {
    const meta: MetaProfil = {
      matinEnvoye: "2026-11-17",
      plan: {
        jour: "2026-11-17",
        verdict: "jouer",
        message: "",
        calculeLe: "2026-11-17T06:00:00Z",
        source: "client",
        sessions: [
          { id: "2026-11-17-1855", heure: "2026-11-17T17:55:00Z", libelle: "18h55", nb: 2, total: 8.4 },
          { id: "2026-11-17-2100", heure: "2026-11-17T20:00:00Z", libelle: "21h00", nb: 1, total: 3 },
        ],
      },
    };
    const a = await tacheProfil(etat(), meta, Date.parse("2026-11-17T17:56:00Z"), deps);
    expect(a.notifications).toHaveLength(1);
    expect(a.notifications[0].url).toBe("/?session=2026-11-17-1855");
    expect(a.notifications[0].texte).toContain("2 paris prêts");
    const b = await tacheProfil(etat(), a.meta, Date.parse("2026-11-17T18:10:00Z"), deps);
    expect(b.notifications).toHaveLength(0);
  });
});
