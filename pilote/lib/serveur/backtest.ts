// Collecte de l'historique et exécution du backtest côté serveur.
// La collecte avance jour par jour (une requête courte à chaque fois) : elle se pilote depuis le téléphone.

import "server-only";
import type { MarketKey } from "../types";
import type { MatchHistorique, ParametresBacktest, RapportBacktest } from "../backtest/types";
import { executerBacktest } from "../backtest/moteur";
import { lireCsvResultats, saison, trouverResultat, urlResultats, CODES_FOOTBALL_DATA, type ResultatCsv } from "../backtest/resultats";
import { historiqueCotes, historiqueMatchs, quota } from "../oddsapi";
import { nomSport } from "../sports";
import { stockage } from "./stockage";

export const CLE_RAPPORT = "backtest:rapport";
const TAILLE_MORCEAU = 400;

/** Le rapport est découpé en morceaux pour rester sous la taille maximale d'une entrée du stockage. */
export async function enregistrerRapport(r: RapportBacktest) {
  const st = stockage();
  const morceaux = Math.ceil(r.paris.length / TAILLE_MORCEAU);
  for (let i = 0; i < morceaux; i++) await st.set(`${CLE_RAPPORT}:paris:${i}`, r.paris.slice(i * TAILLE_MORCEAU, (i + 1) * TAILLE_MORCEAU));
  await st.set(CLE_RAPPORT, { ...r, paris: [], morceaux });
}

export async function lireRapport(): Promise<RapportBacktest | null> {
  const st = stockage();
  const r = await st.get<RapportBacktest & { morceaux?: number }>(CLE_RAPPORT);
  if (!r) return null;
  const parts = await Promise.all(Array.from({ length: r.morceaux ?? 0 }, (_, i) => st.get<RapportBacktest["paris"]>(`${CLE_RAPPORT}:paris:${i}`)));
  const { morceaux: _m, ...reste } = r;
  return { ...reste, paris: [...r.paris, ...parts.flatMap((x) => x ?? [])] };
}
const cleJour = (sport: string, jour: string) => `backtest:jour:${sport}:${jour}`;

export interface OptionsCollecte {
  decision: "matin" | "avant"; // le matin (comme le plan du jour) ou N heures avant chaque match
  heuresAvant: number;
  marches: MarketKey[];
}

const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");

/** Collecte un jour (UTC) d'un championnat. Retourne le nombre de matchs et les crédits consommés. */
export async function collecterJour(sport: string, jour: string, o: OptionsCollecte): Promise<{ matchs: number; credits: number; deja: boolean; restants: number | null }> {
  const st = stockage();
  const deja = await st.get<MatchHistorique[]>(cleJour(sport, jour));
  if (deja) return { matchs: deja.length, credits: 0, deja: true, restants: quota().remaining };

  const debutJour = Date.parse(`${jour}T00:00:00Z`);
  const finJour = debutJour + 86_400_000;
  const liste = (await historiqueMatchs(sport, iso(debutJour - 3_600_000))).filter((m) => {
    const t = Date.parse(m.commence);
    return t >= debutJour && t < finJour;
  });
  let credits = 1;
  if (!liste.length) {
    await st.set(cleJour(sport, jour), []);
    return { matchs: 0, credits, deja: false, restants: quota().remaining };
  }

  const coupsEnvoi = [...new Set(liste.map((m) => m.commence))].sort();
  const instantDecision = (commence: string) => {
    const t = Date.parse(commence);
    if (o.decision === "avant") return iso(t - o.heuresAvant * 3_600_000);
    // Le matin : 8 h UTC (≈ 9 h à Paris), ou une heure avant le premier match s'il est plus tôt.
    return iso(Math.min(debutJour + 8 * 3_600_000, Date.parse(coupsEnvoi[0]) - 3_600_000));
  };
  const instants = new Map<string, Awaited<ReturnType<typeof historiqueCotes>>>();
  const charger = async (t: string) => {
    if (!instants.has(t)) {
      instants.set(t, await historiqueCotes(sport, t, o.marches));
      credits += 10 * o.marches.length;
    }
    return instants.get(t)!;
  };

  const matchs: MatchHistorique[] = [];
  for (const c of coupsEnvoi) {
    const dec = await charger(instantDecision(c));
    const clo = await charger(iso(Date.parse(c) - 5 * 60_000));
    for (const m of liste.filter((x) => x.commence === c)) {
      const ed = dec.events.find((e) => e.id === m.id);
      if (!ed || !ed.bookmakers.some((b) => b.key === "winamax_fr")) continue;
      const ec = clo.events.find((e) => e.id === m.id);
      matchs.push({
        id: m.id,
        sportKey: sport,
        sportTitle: nomSport(sport),
        commence: m.commence,
        home: m.home,
        away: m.away,
        decision: { t: dec.t, bookmakers: ed.bookmakers },
        ...(ec ? { cloture: { t: clo.t, bookmakers: ec.bookmakers } } : {}),
      });
    }
  }
  await st.set(cleJour(sport, jour), matchs);
  return { matchs: matchs.length, credits, deja: false, restants: quota().remaining };
}

async function resultats(sport: string, dateIso: string): Promise<ResultatCsv[]> {
  if (!CODES_FOOTBALL_DATA[sport]) return [];
  const s = saison(dateIso);
  const cle = `backtest:resultats:${sport}:${s}`;
  const enCache = await stockage().get<{ t: number; r: ResultatCsv[] }>(cle);
  // La saison en cours est rafraîchie au bout de 12 h ; les saisons passées sont gardées.
  if (enCache && (s !== saison(new Date().toISOString()) || Date.now() - enCache.t < 12 * 3_600_000)) return enCache.r;
  const res = await fetch(urlResultats(sport, s), { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return enCache?.r ?? [];
  const r = lireCsvResultats(await res.text());
  await stockage().set(cle, { t: Date.now(), r });
  return r;
}

export function joursEntre(du: string, au: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${du}T00:00:00Z`); t <= Date.parse(`${au}T00:00:00Z`) && out.length < 800; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** Exécute le backtest sur les jours déjà collectés et enregistre le rapport. */
export async function executerSurCollecte(sports: string[], du: string, au: string, p: ParametresBacktest): Promise<RapportBacktest> {
  const st = stockage();
  const cles = sports.flatMap((sport) => joursEntre(du, au).map((jour) => cleJour(sport, jour)));
  const tous: MatchHistorique[] = [];
  for (let i = 0; i < cles.length; i += 50) {
    const lots = await Promise.all(cles.slice(i, i + 50).map((k) => st.get<MatchHistorique[]>(k).catch(() => null)));
    for (const l of lots) tous.push(...(l ?? []));
  }
  // Scores : football-data.co.uk (football européen).
  const parSaison = new Map<string, ResultatCsv[]>();
  for (const m of tous) {
    const k = `${m.sportKey}:${saison(m.commence)}`;
    if (!parSaison.has(k)) parSaison.set(k, await resultats(m.sportKey, m.commence).catch(() => []));
    const r = trouverResultat(m, parSaison.get(k)!);
    if (r) m.resultat = { home: r.butsDom, away: r.butsExt };
  }
  const rapport = executerBacktest(tous, p, "reel");
  await enregistrerRapport(rapport);
  return rapport;
}

/** Estimation grossière des crédits nécessaires (un championnat joue environ un jour sur deux). */
export function estimerCredits(nbSports: number, nbJours: number, o: OptionsCollecte): number {
  const instantanes = o.decision === "matin" ? 1 + 4 : 4 + 4;
  return Math.round(nbSports * nbJours * (0.15 + 0.45 * (1 + 10 * o.marches.length * instantanes)));
}
