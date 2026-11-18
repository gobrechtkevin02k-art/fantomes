import { describe, expect, it } from "vitest";
import { historiqueDemo } from "../demo";
import { executerBacktest } from "./moteur";
import { PARAMETRES_DEFAUT } from "./types";
import { lireCsvResultats, normaliserNom, ressemblance, saison, trouverResultat } from "./resultats";
import { clvGlobal, parIndice } from "../engine/analyse";
import { statistiques } from "../engine/bankroll";

describe("scores football-data.co.uk", () => {
  const csv = "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR\nE0,16/08/2024,20:00,Man United,Fulham,1,0,H\nE0,17/08/2024,12:30,Ipswich,Liverpool,0,2,A\nE0,18/08/2024,16:30,Chelsea,Man City,,,\n";
  it("lit le fichier et ignore les matchs sans score", () => {
    const r = lireCsvResultats(csv);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ date: "2024-08-16", home: "Man United", away: "Fulham", butsDom: 1, butsExt: 0 });
  });
  it("rapproche les noms d'équipes des deux sources", () => {
    expect(normaliserNom("Paris SG")).toEqual(["paris", "saint", "germain"]);
    expect(ressemblance("Manchester United", "Man United")).toBe(1);
    expect(ressemblance("Paris Saint Germain", "Paris SG")).toBe(1);
    expect(ressemblance("Liverpool", "Fulham")).toBe(0);
    const r = lireCsvResultats(csv);
    expect(trouverResultat({ commence: "2024-08-16T19:00:00Z", home: "Manchester United", away: "Fulham" }, r)?.butsDom).toBe(1);
    expect(trouverResultat({ commence: "2024-08-17T11:30:00Z", home: "Ipswich Town", away: "Liverpool" }, r)?.butsExt).toBe(2);
    expect(trouverResultat({ commence: "2024-09-17T11:30:00Z", home: "Ipswich Town", away: "Liverpool" }, r)).toBeNull();
  });
  it("calcule le code de saison", () => {
    expect(saison("2024-08-16T00:00:00Z")).toBe("2425");
    expect(saison("2025-03-01T00:00:00Z")).toBe("2425");
  });
});

describe("moteur du backtest", () => {
  const T = Date.parse("2026-11-17T12:00:00Z");
  const historique = historiqueDemo(["soccer_france_ligue_one", "soccer_epl", "basketball_nba"], T, 60);

  it("rejoue Pilote sur l'historique et produit un rapport cohérent", () => {
    const r = executerBacktest(historique, PARAMETRES_DEFAUT, "demo");
    expect(r.matchs).toBe(historique.length);
    expect(r.paris.length).toBeGreaterThan(10);
    expect(r.paris.every((p) => p.statut !== "en_cours")).toBe(true);
    // Jamais de pari placé après le coup d'envoi.
    expect(r.paris.every((p) => Date.parse(p.creeLe) < Date.parse(p.jambes[0].commence))).toBe(true);
    // Bankroll finale = départ + résultat des paris.
    const s = statistiques(r.paris);
    expect(r.bankrollFinale).toBeCloseTo(1000 + s.profit, 6);
    // Les mises restent sous le plafond de sécurité du profil (3 % de la bankroll de départ, à la louche).
    expect(Math.max(...r.paris.map((p) => p.mise))).toBeLessThanOrEqual(1000 * 0.05);
  });

  it("mesure la cote de clôture et la réussite par indice", () => {
    const r = executerBacktest(historique, PARAMETRES_DEFAUT, "demo");
    const clv = clvGlobal(r.paris, r.clotures);
    expect(clv.n).toBe(r.paris.length);
    // En démo, Winamax est plus bruitée que le marché : les paris repérés battent la clôture en moyenne.
    expect(clv.moyenne).toBeGreaterThan(0);
    expect(parIndice(r.paris).length).toBeGreaterThan(0);
  });

  it("est déterministe et ignore les matchs sans score", () => {
    const a = executerBacktest(historique, PARAMETRES_DEFAUT, "demo");
    const b = executerBacktest([...historique, { ...historique[0], id: "sans-score", resultat: undefined }], PARAMETRES_DEFAUT, "demo");
    expect(b.paris.length).toBe(a.paris.length);
    expect(b.matchsSansResultat).toBe(1);
  });
});
