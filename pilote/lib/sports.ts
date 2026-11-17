// Catalogue des compétitions les plus courantes (clés de The Odds API) avec leur nom en français.

export interface SportCatalogue {
  key: string;
  titre: string;
  groupe: string;
  emoji: string;
}

export const CATALOGUE: SportCatalogue[] = [
  { key: "soccer_france_ligue_one", titre: "Ligue 1", groupe: "Football", emoji: "⚽" },
  { key: "soccer_france_ligue_two", titre: "Ligue 2", groupe: "Football", emoji: "⚽" },
  { key: "soccer_epl", titre: "Premier League", groupe: "Football", emoji: "⚽" },
  { key: "soccer_spain_la_liga", titre: "LaLiga", groupe: "Football", emoji: "⚽" },
  { key: "soccer_italy_serie_a", titre: "Serie A", groupe: "Football", emoji: "⚽" },
  { key: "soccer_germany_bundesliga", titre: "Bundesliga", groupe: "Football", emoji: "⚽" },
  { key: "soccer_uefa_champs_league", titre: "Ligue des champions", groupe: "Football", emoji: "⚽" },
  { key: "soccer_uefa_europa_league", titre: "Ligue Europa", groupe: "Football", emoji: "⚽" },
  { key: "soccer_portugal_primeira_liga", titre: "Liga Portugal", groupe: "Football", emoji: "⚽" },
  { key: "soccer_netherlands_eredivisie", titre: "Eredivisie", groupe: "Football", emoji: "⚽" },
  { key: "basketball_nba", titre: "NBA", groupe: "Basket", emoji: "🏀" },
  { key: "basketball_euroleague", titre: "Euroleague", groupe: "Basket", emoji: "🏀" },
  { key: "tennis_atp_finals", titre: "ATP Finals", groupe: "Tennis", emoji: "🎾" },
  { key: "icehockey_nhl", titre: "NHL", groupe: "Hockey", emoji: "🏒" },
  { key: "americanfootball_nfl", titre: "NFL", groupe: "Foot US", emoji: "🏈" },
  { key: "rugbyunion_six_nations", titre: "Tournoi des Six Nations", groupe: "Rugby", emoji: "🏉" },
];

export const SPORTS_PAR_DEFAUT = [
  "soccer_france_ligue_one",
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_uefa_champs_league",
  "basketball_nba",
];

const parCle = new Map(CATALOGUE.map((s) => [s.key, s]));

export function nomSport(key: string, titreApi?: string): string {
  return parCle.get(key)?.titre ?? titreApi ?? key;
}

export function emojiSport(key: string): string {
  const s = parCle.get(key);
  if (s) return s.emoji;
  if (key.startsWith("soccer")) return "⚽";
  if (key.startsWith("basketball")) return "🏀";
  if (key.startsWith("tennis")) return "🎾";
  if (key.startsWith("icehockey")) return "🏒";
  if (key.startsWith("americanfootball")) return "🏈";
  if (key.startsWith("rugby")) return "🏉";
  if (key.startsWith("baseball")) return "⚾";
  if (key.startsWith("mma") || key.startsWith("boxing")) return "🥊";
  return "🏆";
}

/** Bookmakers demandés à The Odds API (10 maximum pour un coût d'un crédit par marché). */
export const BOOKMAKERS_API = [
  "winamax_fr",
  "pinnacle",
  "betfair_ex_eu",
  "betclic_fr",
  "unibet_fr",
  "pmu_fr",
  "netbet_fr",
  "marathonbet",
  "onexbet",
  "sport888",
];
