import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    beta = { messages: { create } };
  }
  return { default: Anthropic };
});

import { analyserMatch } from "./analyste";

const demande = {
  id: "e1|h2h|A",
  sport: "soccer",
  competition: "Ligue 1",
  debut: "2026-11-21T20:00:00Z",
  domicile: "Lens",
  exterieur: "Lille",
  selection: "Victoire Lens",
  coteWinamax: 2.3,
  coteJuste: 2.1,
  avantage: 0.095,
  confiance: 88,
  bookmakers: 5,
};

const sortie = {
  verdict: "prudence",
  resume: "L'attaquant titulaire est incertain.",
  points_forts: ["Bonne forme à domicile"],
  points_faibles: ["Attaquant incertain"],
  infos_cles: ["Compositions attendues vers 20h"],
  avis_mise: "Réduire la mise.",
  attendre_compositions: true,
  confiance_analyste: 62,
};

describe("analyste IA", () => {
  beforeEach(() => create.mockReset());

  it("relance après une pause de la recherche web puis lit l'outil rendre_analyse", async () => {
    create
      .mockResolvedValueOnce({
        stop_reason: "pause_turn",
        model: "claude-opus-5-5",
        content: [{ type: "web_search_tool_result", tool_use_id: "s1", content: [{ type: "web_search_result", url: "https://exemple.fr/lens", title: "Lens : le point", encrypted_content: "", page_age: null }] }],
      })
      .mockResolvedValueOnce({ stop_reason: "tool_use", model: "claude-opus-5-5", content: [{ type: "tool_use", id: "t1", name: "rendre_analyse", input: sortie }] });
    const a = await analyserMatch(demande);
    expect(create).toHaveBeenCalledTimes(2);
    const params = create.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.tools[0].type).toBe("web_search_20260209");
    expect(params.system).toContain("Compositions"); // fiche football chargée
    expect(params.system).toContain("Méthode de l'analyste Pilote");
    expect(create.mock.calls[1][0].messages).toHaveLength(2); // la réponse en pause est renvoyée telle quelle
    expect(a.verdict).toBe("prudence");
    expect(a.attendreCompositions).toBe(true);
    expect(a.sources).toEqual([{ url: "https://exemple.fr/lens", titre: "Lens : le point" }]);
  });

  it("échoue proprement sur un refus", async () => {
    create.mockResolvedValueOnce({ stop_reason: "refusal", model: "claude-opus-5-5", content: [] });
    await expect(analyserMatch(demande)).rejects.toThrow(/refusée/);
  });
});
