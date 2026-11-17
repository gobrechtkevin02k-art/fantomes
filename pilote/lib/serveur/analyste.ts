// L'analyste IA : Claude cherche les informations de dernière minute sur le web (blessures, compositions,
// rotation, contexte) et rend un verdict structuré que le conseiller applique au plan du jour.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AnalyseIA, VerdictIA } from "../types";

export const MODELE_ANALYSE = process.env.ANALYSE_MODELE?.trim() || "claude-opus-5-5";

export const iaConfiguree = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export interface DemandeAnalyse {
  id: string;
  sport: string;
  competition: string;
  debut: string;
  domicile: string;
  exterieur: string;
  selection: string;
  coteWinamax: number;
  coteJuste: number;
  avantage: number;
  confiance: number;
  bookmakers: number;
  mouvement?: string;
}

const SYSTEME = `Tu es l'analyste de Pilote, un assistant de paris sportifs utilisé par des parieurs souvent débutants.

Un modèle de cotes a déjà repéré ce pari : la cote Winamax est supérieure au juste prix estimé à partir des autres bookmakers. Ton rôle n'est pas de refaire un pronostic complet, car les cotes intègrent déjà l'information publique. Ton rôle est de vérifier, avec la recherche web, ce que les cotes pourraient ne pas encore refléter et qui changerait la décision :
- absences confirmées ou incertaines (blessures, suspensions, joueurs ménagés), compositions probables ou officielles ;
- rotation à cause d'un match important à venir, enjeu du match, fatigue (calendrier), changement d'entraîneur ;
- conditions particulières (météo, terrain, déplacement), et forme récente seulement si elle éclaire un de ces points.

Règles :
- N'invente aucun fait. Appuie-toi uniquement sur ce que tu trouves, et dis-le clairement quand une information manque.
- Fais au plus quelques recherches ciblées, privilégie les sources récentes (presse sportive, sites officiels des clubs).
- Écris en français simple, compréhensible par un débutant, sans jargon inutile.

Verdicts :
- "confirmer" : rien de trouvé ne contredit le pari, ou des éléments le soutiennent.
- "prudence" : incertitude réelle (joueur clé incertain, informations contradictoires, compositions décisives pas encore connues).
- "eviter" : une information sérieuse va clairement contre ce pari (absence majeure confirmée, équipe qui fait tourner, cote qui semble porter sur un autre marché).

Quand tu as terminé, appelle obligatoirement l'outil rendre_analyse avec ta conclusion.`;

const OUTIL_ANALYSE: Anthropic.Beta.BetaTool = {
  name: "rendre_analyse",
  description: "Rend la conclusion de l'analyse du match. À appeler une seule fois, à la fin.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["verdict", "resume", "points_forts", "points_faibles", "infos_cles", "avis_mise", "attendre_compositions", "confiance_analyste"],
    properties: {
      verdict: { type: "string", enum: ["confirmer", "prudence", "eviter"], description: "Décision sur le pari." },
      resume: { type: "string", description: "Une ou deux phrases qui expliquent le verdict à un débutant." },
      points_forts: { type: "array", items: { type: "string" }, description: "Ce qui va dans le sens du pari (3 au plus)." },
      points_faibles: { type: "array", items: { type: "string" }, description: "Ce qui va contre le pari (3 au plus)." },
      infos_cles: { type: "array", items: { type: "string" }, description: "Informations de dernière minute trouvées : absences, compositions, contexte." },
      avis_mise: { type: "string", description: "Une phrase sur la mise : la garder, la réduire, ou s'abstenir, et pourquoi." },
      attendre_compositions: { type: "boolean", description: "Vrai si les compositions officielles ne sont pas encore connues et peuvent changer la décision." },
      confiance_analyste: { type: "integer", description: "Confiance de l'analyste dans le pari, de 0 à 100." },
    },
  },
};

interface SortieOutil {
  verdict: VerdictIA;
  resume: string;
  points_forts: string[];
  points_faibles: string[];
  infos_cles: string[];
  avis_mise: string;
  attendre_compositions: boolean;
  confiance_analyste: number;
}

const pctFr = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")} %`;

function message(d: DemandeAnalyse): string {
  const date = new Date(d.debut).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" });
  return [
    "Analyse ce pari repéré par Pilote :",
    `- Sport / compétition : ${d.sport} / ${d.competition}`,
    `- Match : ${d.domicile} contre ${d.exterieur}, le ${date} (heure de Paris)`,
    `- Pari : ${d.selection}`,
    `- Cote Winamax : ${d.coteWinamax.toFixed(2)} ; juste prix estimé : ${d.coteJuste.toFixed(2)} (avantage ${pctFr(d.avantage)})`,
    `- Indice de confiance du modèle : ${Math.round(d.confiance)}/100, à partir de ${d.bookmakers} bookmakers de référence`,
    d.mouvement ? `- Mouvement de cote : ${d.mouvement}` : "",
    `- Date et heure actuelles : ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
  ]
    .filter(Boolean)
    .join("\n");
}

let client: Anthropic | null = null;

export async function analyserMatch(d: DemandeAnalyse): Promise<AnalyseIA> {
  client ??= new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: message(d) }];
  const sources = new Map<string, string>();
  let relance = false;

  for (let tour = 0; tour < 5; tour++) {
    const reponse = await client.beta.messages.create({
      model: MODELE_ANALYSE,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: SYSTEME,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }, OUTIL_ANALYSE],
      messages,
    });

    for (const bloc of reponse.content) {
      if (bloc.type === "web_search_tool_result" && Array.isArray(bloc.content)) {
        for (const r of bloc.content) if (sources.size < 8 && !sources.has(r.url)) sources.set(r.url, r.title);
      }
    }

    if (reponse.stop_reason === "refusal") throw new Error("L'analyse a été refusée par le modèle.");

    const appel = reponse.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "rendre_analyse");
    if (appel) {
      const o = appel.input as SortieOutil;
      return {
        verdict: o.verdict,
        resume: o.resume,
        pointsForts: o.points_forts.slice(0, 4),
        pointsFaibles: o.points_faibles.slice(0, 4),
        infosCles: o.infos_cles.slice(0, 6),
        avisMise: o.avis_mise,
        attendreCompositions: o.attendre_compositions,
        confianceAnalyste: Math.max(0, Math.min(100, Math.round(o.confiance_analyste))),
        sources: [...sources].map(([url, titre]) => ({ url, titre })),
        genereLe: new Date().toISOString(),
        modele: reponse.model,
      };
    }

    messages.push({ role: "assistant", content: reponse.content });
    if (reponse.stop_reason === "pause_turn") continue; // la recherche web n'est pas terminée : on relance tel quel
    if (relance) break;
    relance = true;
    messages.push({ role: "user", content: "Appelle maintenant l'outil rendre_analyse avec ta conclusion." });
  }
  throw new Error("L'analyse n'a pas pu aboutir.");
}
