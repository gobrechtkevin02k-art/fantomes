// Lecture d'une capture d'écran Winamax par Claude (vision) : paris, cotes, mises, résultats,
// et brouillon d'un message de gains ou de pertes, sobre et honnête.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { LectureCapture, PariLu, StatutLu } from "../actus";
import { MODELE_ANALYSE } from "./analyste";

const SYSTEME = `Tu lis des captures d'écran de l'application Winamax (tickets de paris, historique « Mes paris », solde) pour Pilote, un assistant de paris sportifs.

Ta mission :
1. Relever fidèlement chaque pari visible : sélection, match, cote, mise, montant retourné (gain total, mise comprise) et résultat (gagné, perdu, en cours, remboursé, cash-out), ainsi que le numéro du ticket et la date s'ils sont visibles.
2. Ne jamais deviner un chiffre : si une valeur est illisible ou absente, mets null. Si le résultat n'est pas visible, statut « inconnu ».
3. Évaluer ta confiance dans la lecture (0 à 100). Baisse-la nettement si l'image est floue, coupée, ou si des chiffres sont ambigus.
4. Rédiger un message court en français pour annoncer le résultat aux abonnés :
   - factuel et sobre, en citant les paris et le bilan chiffré ;
   - une perte s'annonce aussi clairement qu'un gain, sans l'enjoliver ;
   - aucune incitation à parier, aucune promesse de gain, pas de « pari sûr », pas d'émojis en excès ;
   - 2 à 6 lignes.

Quand tu as terminé, appelle obligatoirement l'outil rendre_lecture.`;

const OUTIL: Anthropic.Beta.BetaTool = {
  name: "rendre_lecture",
  description: "Rend la lecture de la capture d'écran. À appeler une seule fois.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["type_capture", "paris", "solde", "confiance_lecture", "remarques", "message"],
    properties: {
      type_capture: { type: "string", enum: ["ticket", "historique", "solde", "autre"] },
      paris: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["selection", "match", "cote", "mise", "gain", "statut", "numero_ticket", "date"],
          properties: {
            selection: { type: "string", description: "Ce qui a été joué (ex. « Lens », « Plus de 2,5 buts »)." },
            match: { type: "string", description: "Les deux équipes ou joueurs, ou chaîne vide." },
            cote: { type: ["number", "null"] },
            mise: { type: ["number", "null"], description: "En euros." },
            gain: { type: ["number", "null"], description: "Montant total retourné en euros, mise comprise." },
            statut: { type: "string", enum: ["gagne", "perdu", "en_cours", "rembourse", "cashout", "inconnu"] },
            numero_ticket: { type: ["string", "null"] },
            date: { type: ["string", "null"], description: "Date du pari ou du match, telle qu'affichée." },
          },
        },
      },
      solde: { type: ["number", "null"], description: "Solde du compte s'il est visible, en euros." },
      confiance_lecture: { type: "integer" },
      remarques: { type: "string", description: "Ce qui était difficile à lire, ou chaîne vide." },
      message: { type: "string" },
    },
  },
};

interface Sortie {
  type_capture: LectureCapture["type"];
  paris: { selection: string; match: string; cote: number | null; mise: number | null; gain: number | null; statut: StatutLu; numero_ticket: string | null; date: string | null }[];
  solde: number | null;
  confiance_lecture: number;
  remarques: string;
  message: string;
}

let client: Anthropic | null = null;

/** image : data URL JPEG/PNG/WebP (déjà compressée par le navigateur). */
export async function lireCapture(image: string, contexte?: string): Promise<LectureCapture> {
  client ??= new Anthropic();
  const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) throw new Error("Image invalide.");
  const reponse = await client.beta.messages.create({
    model: MODELE_ANALYSE,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: SYSTEME,
    tools: [OUTIL],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg" | "image/png" | "image/webp", data: m[2] } },
          { type: "text", text: `Lis cette capture Winamax et appelle rendre_lecture.${contexte ? `\nContexte donné par l'administrateur : ${contexte.slice(0, 500)}` : ""}` },
        ],
      },
    ],
  });
  if (reponse.stop_reason === "refusal") throw new Error("La lecture a été refusée par le modèle.");
  const appel = reponse.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "rendre_lecture");
  if (!appel) throw new Error("La capture n'a pas pu être lue. Réessaie avec une image plus nette.");
  const o = appel.input as Sortie;
  const paris: PariLu[] = o.paris.slice(0, 30).map((p) => ({
    selection: p.selection.slice(0, 160),
    match: p.match.slice(0, 160),
    cote: p.cote,
    mise: p.mise,
    gain: p.gain,
    statut: p.statut,
    numeroTicket: p.numero_ticket,
    date: p.date,
  }));
  return {
    type: o.type_capture,
    paris,
    solde: o.solde,
    confiance: Math.max(0, Math.min(100, Math.round(o.confiance_lecture))),
    remarques: o.remarques,
    message: o.message.slice(0, 1500),
    modele: reponse.model,
  };
}
