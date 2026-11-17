// Client serveur pour The Odds API (https://the-odds-api.com), avec un cache mémoire pour économiser le quota.
// La clé reste côté serveur : elle n'est jamais envoyée au navigateur.

import "server-only";
import type { Bookmaker, MarketKey, Quota, ScoreEvent, SportEvent, SportInfo } from "./types";
import { BOOKMAKERS_API } from "./sports";

const BASE = "https://api.the-odds-api.com/v4";
const TTL_COTES = 10 * 60_000;
const TTL_SCORES = 5 * 60_000; // court : les scores servent au suivi en temps réel
const TTL_SPORTS = 6 * 3_600_000;

interface Entree<T> {
  t: number;
  data: T;
}
const cache = new Map<string, Entree<unknown>>();
let dernierQuota: Quota = { remaining: null, used: null };

export const cleApi = () => process.env.ODDS_API_KEY?.trim() || "";
export const cleSportValide = (s: string) => /^[a-z0-9_]{2,80}$/.test(s);

async function appeler<T>(chemin: string, params: Record<string, string>, ttl: number): Promise<T> {
  const cleCache = `${chemin}?${new URLSearchParams(params).toString()}`;
  const hit = cache.get(cleCache) as Entree<T> | undefined;
  if (hit && Date.now() - hit.t < ttl) return hit.data;

  const url = `${BASE}${chemin}?${new URLSearchParams({ ...params, apiKey: cleApi() }).toString()}`;
  const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  const rem = res.headers.get("x-requests-remaining");
  const used = res.headers.get("x-requests-used");
  if (rem !== null || used !== null) dernierQuota = { remaining: rem !== null ? Number(rem) : null, used: used !== null ? Number(used) : null };
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) msg += ` ${j.message}`;
    } catch {
      /* corps non JSON */
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as T;
  cache.set(cleCache, { t: Date.now(), data });
  return data;
}

export const quota = () => dernierQuota;

interface ApiOutcome {
  name: string;
  price: number;
  point?: number;
  link?: string;
}
interface ApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: { key: string; title: string; link?: string; markets: { key: string; link?: string; outcomes: ApiOutcome[] }[] }[];
}

const MARCHES_CONNUS = new Set<MarketKey>(["h2h", "totals", "spreads"]);

function normaliser(e: ApiEvent): SportEvent {
  const bookmakers: Bookmaker[] = (e.bookmakers ?? []).map((b) => ({
    key: b.key,
    title: b.title,
    link: b.link,
    markets: b.markets
      .filter((m) => MARCHES_CONNUS.has(m.key as MarketKey))
      .map((m) => ({
        key: m.key as MarketKey,
        link: m.link,
        outcomes: m.outcomes.map((o) => ({ name: o.name, price: Number(o.price), point: o.point, link: o.link })),
      })),
  }));
  return { id: e.id, sportKey: e.sport_key, sportTitle: e.sport_title, commence: e.commence_time, home: e.home_team, away: e.away_team, bookmakers };
}

export async function cotesLive(sport: string, marches: MarketKey[], ttl = TTL_COTES): Promise<SportEvent[]> {
  const data = await appeler<ApiEvent[]>(
    `/sports/${sport}/odds`,
    {
      bookmakers: BOOKMAKERS_API.join(","),
      markets: marches.join(","),
      oddsFormat: "decimal",
      dateFormat: "iso",
      includeLinks: "true",
    },
    ttl,
  );
  return data.map(normaliser);
}

interface ApiScore {
  id: string;
  sport_key: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
}

export async function scoresLive(sport: string, joursAvant: number, ttl = TTL_SCORES): Promise<ScoreEvent[]> {
  const data = await appeler<ApiScore[]>(`/sports/${sport}/scores`, { daysFrom: String(joursAvant), dateFormat: "iso" }, ttl);
  return data.map((s) => ({
    id: s.id,
    sportKey: s.sport_key,
    commence: s.commence_time,
    completed: s.completed,
    home: s.home_team,
    away: s.away_team,
    scores: s.scores ? s.scores.map((x) => ({ name: x.name, score: Number(x.score) })) : null,
  }));
}

interface ApiSport {
  key: string;
  group: string;
  title: string;
  active: boolean;
  has_outrights: boolean;
}

export async function sportsLive(): Promise<SportInfo[]> {
  const data = await appeler<ApiSport[]>("/sports", {}, TTL_SPORTS);
  return data.map((s) => ({ key: s.key, group: s.group, title: s.title, active: s.active, outrights: s.has_outrights }));
}
