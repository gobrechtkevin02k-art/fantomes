import { beforeEach, describe, expect, it, vi } from "vitest";

const memoire = new Map<string, unknown>();
vi.mock("./stockage", () => ({
  stockage: () => ({
    type: "memoire",
    get: async (k: string) => (memoire.has(k) ? structuredClone(memoire.get(k)) : null),
    set: async (k: string, v: unknown) => void memoire.set(k, structuredClone(v)),
  }),
}));

const livres = (wina: number[]) => [
  { key: "winamax_fr", title: "Winamax", markets: [{ key: "h2h" as const, outcomes: [{ name: "Lens", price: wina[0] }, { name: "Draw", price: wina[1] }, { name: "Lille", price: wina[2] }] }] },
  { key: "pinnacle", title: "Pinnacle", markets: [{ key: "h2h" as const, outcomes: [{ name: "Lens", price: 2.0 }, { name: "Draw", price: 3.6 }, { name: "Lille", price: 4.1 }] }] },
];
const evt = (wina: number[]) => ({ id: "m1", sportKey: "soccer_france_ligue_one", sportTitle: "Ligue 1", commence: "2025-10-04T19:00:00Z", home: "Lens", away: "Lille", bookmakers: livres(wina) });
const historiqueCotes = vi.fn(async (_s: string, t: string) => ({ t, events: [evt(t.startsWith("2025-10-04T18:55") ? [2.02, 3.5, 3.9] : [2.25, 3.3, 3.7])] }));
vi.mock("../oddsapi", () => ({
  historiqueMatchs: vi.fn(async () => [{ id: "m1", commence: "2025-10-04T19:00:00Z", home: "Lens", away: "Lille" }, { id: "x", commence: "2025-10-05T15:00:00Z", home: "A", away: "B" }]),
  historiqueCotes: (s: string, t: string) => historiqueCotes(s, t),
  quota: () => ({ remaining: 19_000, used: 1000 }),
}));

import { collecterJour, estimerCredits, joursEntre } from "./backtest";

describe("collecte de l'historique", () => {
  beforeEach(() => {
    memoire.clear();
    historiqueCotes.mockClear();
  });

  it("relève les cotes du matin et de clôture, une seule fois par jour", async () => {
    const r = await collecterJour("soccer_france_ligue_one", "2025-10-04", { decision: "matin", heuresAvant: 2, marches: ["h2h"] });
    expect(r).toEqual({ matchs: 1, credits: 21, deja: false, restants: 19_000 });
    expect(historiqueCotes.mock.calls.map((c) => c[1])).toEqual(["2025-10-04T08:00:00Z", "2025-10-04T18:55:00Z"]);
    const stocke = memoire.get("backtest:jour:soccer_france_ligue_one:2025-10-04") as { decision: { bookmakers: unknown[] }; cloture?: unknown }[];
    expect(stocke).toHaveLength(1); // le match du lendemain n'est pas compté ce jour-là
    expect(stocke[0].cloture).toBeDefined();
    const encore = await collecterJour("soccer_france_ligue_one", "2025-10-04", { decision: "matin", heuresAvant: 2, marches: ["h2h"] });
    expect(encore.deja).toBe(true);
    expect(encore.credits).toBe(0);
  });

  it("estime les crédits et liste les jours", () => {
    expect(joursEntre("2025-10-01", "2025-10-03")).toEqual(["2025-10-01", "2025-10-02", "2025-10-03"]);
    expect(estimerCredits(2, 90, { decision: "matin", heuresAvant: 2, marches: ["h2h"] })).toBeGreaterThan(2000);
  });
});
