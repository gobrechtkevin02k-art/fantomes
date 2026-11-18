import { NextResponse } from "next/server";
import { cleApi, cleSportValide } from "@/lib/oddsapi";
import { historiqueDemo } from "@/lib/demo";
import { executerBacktest } from "@/lib/backtest/moteur";
import { PARAMETRES_DEFAUT, type ParametresBacktest, type RapportBacktest } from "@/lib/backtest/types";
import { sportsAvecResultats } from "@/lib/backtest/resultats";
import { collecterJour, enregistrerRapport, estimerCredits, executerSurCollecte, joursEntre, lireRapport, type OptionsCollecte } from "@/lib/serveur/backtest";
import { accesComplet } from "@/lib/serveur/abonnements";
import { estPublic } from "@/lib/serveur/public";
import { cleProfil } from "@/lib/serveur/stockage";
import type { MarketKey, Profil } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const proprietaire = (id: string) => cleProfil(id) && (estPublic(id) || accesComplet(id));
const jourValide = (j: unknown): j is string => typeof j === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j);

function parametres(x: Partial<ParametresBacktest> | undefined): ParametresBacktest {
  const p = { ...PARAMETRES_DEFAUT, ...(x ?? {}) };
  const borne = (v: number, a: number, b: number, d: number) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
  return {
    bankroll: borne(p.bankroll, 10, 1_000_000, 1000),
    profil: (["prudent", "equilibre", "offensif"] as Profil[]).includes(p.profil) ? p.profil : "equilibre",
    conviction: !!p.conviction,
    coteMin: borne(p.coteMin, 1.01, 10, 1.3),
    coteMax: borne(p.coteMax, 1.05, 50, 3.2),
    confianceMin: borne(p.confianceMin, 50, 99, 60),
    edgeMin: borne(p.edgeMin, 0, 0.3, 0.01),
  };
}

function options(x: Partial<OptionsCollecte> | undefined): OptionsCollecte {
  const marches = (x?.marches ?? ["h2h"]).filter((m): m is MarketKey => m === "h2h" || m === "totals");
  return { decision: x?.decision === "avant" ? "avant" : "matin", heuresAvant: Math.min(24, Math.max(1, Number(x?.heuresAvant) || 2)), marches: marches.length ? marches : ["h2h"] };
}

/** Dernier rapport (visible par tous) et informations pour lancer un test (propriétaire). */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const rapport: RapportBacktest | null = await lireRapport().catch(() => null);
  return NextResponse.json({ rapport, proprietaire: proprietaire(id), cotesReelles: !!cleApi(), sports: sportsAvecResultats });
}

export async function POST(req: Request) {
  const c = (await req.json().catch(() => ({}))) as {
    profilId?: string;
    action?: string;
    sport?: string;
    jour?: string;
    sports?: string[];
    du?: string;
    au?: string;
    options?: Partial<OptionsCollecte>;
    parametres?: Partial<ParametresBacktest>;
  };
  if (!proprietaire(c.profilId ?? "")) return NextResponse.json({ erreur: "Réservé au propriétaire du compte." }, { status: 403 });

  try {
    if (c.action === "demo") {
      const rapport = executerBacktest(historiqueDemo([], Date.now(), 120), parametres(c.parametres), "demo");
      await enregistrerRapport(rapport);
      return NextResponse.json({ rapport });
    }
    if (c.action === "estimer") {
      if (!jourValide(c.du) || !jourValide(c.au) || !Array.isArray(c.sports)) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
      return NextResponse.json({ credits: estimerCredits(c.sports.length, joursEntre(c.du, c.au).length, options(c.options)), jours: joursEntre(c.du, c.au) });
    }
    if (c.action === "collecter") {
      if (!cleApi()) return NextResponse.json({ erreur: "Clé The Odds API manquante (ODDS_API_KEY)." }, { status: 501 });
      if (!c.sport || !cleSportValide(c.sport) || !jourValide(c.jour)) return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
      return NextResponse.json(await collecterJour(c.sport, c.jour, options(c.options)));
    }
    if (c.action === "executer") {
      if (!jourValide(c.du) || !jourValide(c.au) || !Array.isArray(c.sports) || joursEntre(c.du, c.au).length > 400)
        return NextResponse.json({ erreur: "Requête invalide (période de 400 jours au plus)." }, { status: 400 });
      const sports = c.sports.filter((s) => typeof s === "string" && cleSportValide(s)).slice(0, 10);
      return NextResponse.json({ rapport: await executerSurCollecte(sports, c.du, c.au, parametres(c.parametres)) });
    }
    return NextResponse.json({ erreur: "Action inconnue." }, { status: 400 });
  } catch (e) {
    const msg = (e as Error).message || "Erreur";
    // 401/403/422 de The Odds API : l'historique demande une offre payante.
    if (/^4(01|03|22)/.test(msg)) return NextResponse.json({ erreur: `The Odds API refuse l'historique (${msg}). Il faut une offre payante.` }, { status: 402 });
    return NextResponse.json({ erreur: msg }, { status: 502 });
  }
}
