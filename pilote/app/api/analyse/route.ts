import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { analyserMatch, iaConfiguree, type DemandeAnalyse } from "@/lib/serveur/analyste";
import { stockage } from "@/lib/serveur/stockage";
import type { AnalyseIA } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TTL = 3 * 3600; // une analyse reste valable 3 h
const MAX_PAR_HEURE = Number(process.env.ANALYSE_MAX_HEURE) || 30;
const appels: number[] = [];

function valide(d: Partial<DemandeAnalyse>): d is DemandeAnalyse {
  const txt = (x: unknown, max = 160) => typeof x === "string" && x.length > 0 && x.length <= max;
  const num = (x: unknown) => typeof x === "number" && Number.isFinite(x);
  return (
    txt(d.id, 300) &&
    txt(d.sport) &&
    txt(d.competition) &&
    txt(d.debut, 40) &&
    txt(d.domicile) &&
    txt(d.exterieur) &&
    txt(d.selection) &&
    num(d.coteWinamax) &&
    num(d.coteJuste) &&
    num(d.avantage) &&
    num(d.confiance) &&
    num(d.bookmakers) &&
    (d.mouvement === undefined || txt(d.mouvement, 200))
  );
}

export async function POST(req: Request) {
  if (!iaConfiguree()) return NextResponse.json({ erreur: "L'analyse IA n'est pas configurée (clé ANTHROPIC_API_KEY manquante)." }, { status: 501 });
  let d: Partial<DemandeAnalyse>;
  try {
    d = (await req.json()) as Partial<DemandeAnalyse>;
  } catch {
    return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  }
  if (!valide(d)) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });

  const cle = `analyse:${d.id}`;
  const enCache = await stockage().get<AnalyseIA>(cle).catch(() => null);
  if (enCache) return NextResponse.json({ analyse: enCache, cache: true });

  const maintenant = Date.now();
  while (appels.length && appels[0] < maintenant - 3_600_000) appels.shift();
  if (appels.length >= MAX_PAR_HEURE) return NextResponse.json({ erreur: "Trop d'analyses demandées cette heure-ci. Réessaie un peu plus tard." }, { status: 429 });
  appels.push(maintenant);

  try {
    const analyse = await analyserMatch(d);
    await stockage().set(cle, analyse, TTL).catch(() => {});
    return NextResponse.json({ analyse, cache: false });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ erreur: "Clé d'API Anthropic invalide." }, { status: 502 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ erreur: "L'IA est très sollicitée, réessaie dans une minute." }, { status: 503 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ erreur: `Erreur de l'IA (${e.status ?? "réseau"}).` }, { status: 502 });
    return NextResponse.json({ erreur: (e as Error).message || "Analyse impossible." }, { status: 502 });
  }
}
