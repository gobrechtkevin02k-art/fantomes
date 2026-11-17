import { NextResponse } from "next/server";
import { coteDemo, scoresDemo } from "@/lib/demo";
import { cleApi, cleSportValide, cotesLive, scoresLive } from "@/lib/oddsapi";
import { evaluerPariDirect } from "@/lib/engine/direct";
import { offreDe } from "@/lib/serveur/abonnements";
import { cleProfil } from "@/lib/serveur/stockage";
import { droitsDe } from "@/lib/offres";
import type { MarketKey, Pari } from "@/lib/types";

export const dynamic = "force-dynamic";

const TTL_DIRECT = 2 * 60_000;

/** Suivi en direct des paris en cours (offre Élite) : probabilité actuelle, valeur juste, conseil de cash-out. */
export async function POST(req: Request) {
  const c = (await req.json().catch(() => ({}))) as { profilId?: string; paris?: Pari[]; bankroll?: number; marches?: MarketKey[] };
  if (!cleProfil(c.profilId ?? "") || !Array.isArray(c.paris)) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  const { offre } = await offreDe(c.profilId!);
  if (!droitsDe(offre).direct) return NextResponse.json({ erreur: "Le suivi en direct fait partie de l'offre Élite." }, { status: 403 });

  const maintenant = Date.now();
  const paris = c.paris
    .slice(0, 30)
    .filter((p) => p && p.statut === "en_cours" && p.mode === "classique" && Array.isArray(p.jambes) && p.jambes.some((j) => Date.parse(j.commence) <= maintenant));
  if (!paris.length) return NextResponse.json({ evaluations: [] });
  const sports = [...new Set(paris.flatMap((p) => p.jambes.map((j) => j.sportKey)))].filter(cleSportValide).slice(0, 10);
  const marches = (c.marches ?? ["h2h", "totals"]).filter((m): m is MarketKey => ["h2h", "totals", "spreads"].includes(m));

  const [scores, events] = cleApi()
    ? await Promise.all([
        Promise.all(sports.map((s) => scoresLive(s, 1, TTL_DIRECT).catch(() => []))).then((x) => x.flat()),
        Promise.all(sports.map((s) => cotesLive(s, marches, TTL_DIRECT).catch(() => []))).then((x) => x.flat()),
      ])
    : [scoresDemo(sports, maintenant, 1), coteDemo(sports, maintenant)];

  const bankroll = typeof c.bankroll === "number" && c.bankroll > 0 ? c.bankroll : 0;
  const evaluations = paris.map((p) => evaluerPariDirect(p, scores, events, maintenant, bankroll)).filter(Boolean);
  return NextResponse.json({ evaluations, majLe: new Date(maintenant).toISOString() });
}
