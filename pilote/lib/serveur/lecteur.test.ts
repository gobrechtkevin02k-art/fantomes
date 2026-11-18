import { describe, expect, it, vi } from "vitest";
const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    beta = { messages: { create } };
  }
  return { default: Anthropic };
});
import { lireCapture } from "./lecteur";

describe("lecteur de captures", () => {
  it("envoie l'image à Claude et lit l'outil rendre_lecture", async () => {
    create.mockResolvedValueOnce({
      stop_reason: "tool_use",
      model: "claude-opus-5-5",
      content: [
        {
          type: "tool_use",
          id: "t",
          name: "rendre_lecture",
          input: {
            type_capture: "historique",
            paris: [{ selection: "Lens", match: "Lens - Lille", cote: 2.3, mise: 10, gain: 23, statut: "gagne", numero_ticket: null, date: "17/11" }],
            solde: 512.4,
            confiance_lecture: 93,
            remarques: "",
            message: "Gagné : Lens à 2,30, +13 €.",
          },
        },
      ],
    });
    const l = await lireCapture("data:image/jpeg;base64,AAAA");
    const params = create.mock.calls[0][0];
    expect(params.messages[0].content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } });
    expect(params.fallbacks).toBe("default");
    expect(l.paris[0]).toMatchObject({ selection: "Lens", cote: 2.3, statut: "gagne" });
    expect(l.confiance).toBe(93);
    expect(l.solde).toBe(512.4);
  });
  it("refuse une image invalide", async () => {
    await expect(lireCapture("pas une image")).rejects.toThrow(/Image invalide/);
  });
});
