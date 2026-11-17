// Mode démo : génère des matchs et des cotes réalistes (déterministes) quand aucune clé d'API n'est configurée.
// Les probabilités « vraies » viennent d'un modèle de Poisson (football) ou gaussien (basket, tennis),
// chaque bookmaker y ajoute son bruit et sa marge, et les matchs passés reçoivent un score tiré du même modèle.

import type { Bookmaker, BookMarket, ScoreEvent, SportEvent } from "./types";
import { hash, phi, prng } from "./engine/proba";

interface Ligue {
  key: string;
  titre: string;
  type: "foot" | "basket" | "tennis";
  equipes: string[];
  jours: number[]; // jours de la semaine joués (0 = dimanche)
  parJour: [number, number];
  heures: number[]; // heures UTC de début
}

const LIGUES: Ligue[] = [
  {
    key: "soccer_france_ligue_one",
    titre: "Ligue 1",
    type: "foot",
    equipes: ["Paris Saint Germain", "Marseille", "Monaco", "Lille", "Lyon", "Nice", "Lens", "Rennes", "Strasbourg", "Nantes", "Toulouse", "Brest", "Auxerre", "Angers", "Le Havre", "Lorient", "Metz", "Paris FC"],
    jours: [5, 6, 0],
    parJour: [2, 4],
    heures: [15, 17, 19, 20],
  },
  {
    key: "soccer_epl",
    titre: "Premier League",
    type: "foot",
    equipes: ["Liverpool", "Arsenal", "Manchester City", "Chelsea", "Newcastle United", "Aston Villa", "Tottenham Hotspur", "Manchester United", "Brighton and Hove Albion", "Nottingham Forest", "Brentford", "Fulham", "Crystal Palace", "Bournemouth", "Everton", "West Ham United", "Wolverhampton Wanderers", "Leeds United", "Burnley", "Sunderland"],
    jours: [6, 0, 1],
    parJour: [2, 5],
    heures: [12, 14, 15, 17],
  },
  {
    key: "soccer_spain_la_liga",
    titre: "LaLiga",
    type: "foot",
    equipes: ["Real Madrid", "Barcelona", "Atlético Madrid", "Athletic Bilbao", "Villarreal", "Real Betis", "Real Sociedad", "Celta Vigo", "Sevilla", "Valencia", "Girona", "Osasuna", "Getafe", "Rayo Vallecano", "Mallorca", "Espanyol", "Alavés", "Elche", "Levante", "Real Oviedo"],
    jours: [5, 6, 0],
    parJour: [2, 4],
    heures: [13, 15, 17, 20],
  },
  {
    key: "soccer_italy_serie_a",
    titre: "Serie A",
    type: "foot",
    equipes: ["Inter Milan", "Napoli", "AC Milan", "Juventus", "Atalanta BC", "AS Roma", "Lazio", "Bologna", "Fiorentina", "Como", "Torino", "Udinese", "Genoa", "Cagliari", "Lecce", "Parma", "Hellas Verona", "Sassuolo", "Cremonese", "Pisa"],
    jours: [6, 0],
    parJour: [3, 5],
    heures: [11, 14, 17, 19],
  },
  {
    key: "soccer_germany_bundesliga",
    titre: "Bundesliga",
    type: "foot",
    equipes: ["Bayern Munich", "Bayer Leverkusen", "Borussia Dortmund", "RB Leipzig", "Eintracht Frankfurt", "VfB Stuttgart", "SC Freiburg", "VfL Wolfsburg", "Borussia Monchengladbach", "Werder Bremen", "Mainz 05", "Union Berlin", "Augsburg", "TSG Hoffenheim", "FC Koln", "Hamburger SV", "FC St. Pauli", "Heidenheim"],
    jours: [5, 6, 0],
    parJour: [2, 5],
    heures: [14, 17, 19],
  },
  {
    key: "soccer_uefa_champs_league",
    titre: "Ligue des champions",
    type: "foot",
    equipes: ["Real Madrid", "Manchester City", "Bayern Munich", "Paris Saint Germain", "Liverpool", "Inter Milan", "Arsenal", "Barcelona", "Borussia Dortmund", "Atlético Madrid", "Bayer Leverkusen", "Juventus", "Benfica", "Porto", "PSV Eindhoven", "Club Brugge", "Monaco", "Marseille", "Napoli", "Chelsea"],
    jours: [2, 3],
    parJour: [4, 8],
    heures: [17, 20],
  },
  {
    key: "basketball_nba",
    titre: "NBA",
    type: "basket",
    equipes: ["Boston Celtics", "Oklahoma City Thunder", "Denver Nuggets", "Cleveland Cavaliers", "New York Knicks", "Minnesota Timberwolves", "Milwaukee Bucks", "Los Angeles Lakers", "Golden State Warriors", "Dallas Mavericks", "Phoenix Suns", "Miami Heat", "Indiana Pacers", "Orlando Magic", "Houston Rockets", "Memphis Grizzlies", "San Antonio Spurs", "Sacramento Kings", "Atlanta Hawks", "Chicago Bulls"],
    jours: [0, 1, 2, 3, 4, 5, 6],
    parJour: [3, 7],
    heures: [0, 1, 2, 3],
  },
  {
    key: "tennis_atp_finals",
    titre: "ATP Finals",
    type: "tennis",
    equipes: ["Jannik Sinner", "Carlos Alcaraz", "Alexander Zverev", "Novak Djokovic", "Taylor Fritz", "Jack Draper", "Lorenzo Musetti", "Alex de Minaur", "Holger Rune", "Ben Shelton", "Casper Ruud", "Daniil Medvedev"],
    jours: [0, 1, 2, 3, 4, 5, 6],
    parJour: [1, 2],
    heures: [12, 19],
  },
];

// Profils des bookmakers : marge moyenne et bruit (écart-type en log-cote) par rapport à la vraie probabilité.
const BOOKS: { key: string; title: string; marge: number; bruit: number }[] = [
  { key: "pinnacle", title: "Pinnacle", marge: 0.025, bruit: 0.025 },
  { key: "betfair_ex_eu", title: "Betfair", marge: 0.015, bruit: 0.035 },
  { key: "betclic_fr", title: "Betclic", marge: 0.075, bruit: 0.05 },
  { key: "unibet_fr", title: "Unibet", marge: 0.065, bruit: 0.05 },
  { key: "pmu_fr", title: "PMU", marge: 0.08, bruit: 0.06 },
  { key: "winamax_fr", title: "Winamax", marge: 0.055, bruit: 0.05 },
];

const JOUR = 86_400_000;

function force(nom: string, rang: number, n: number): number {
  // Force par équipe : les premières de la liste sont les plus fortes (de +0,9 à -0,9), avec un peu d'aléa.
  const r = prng(hash(nom))();
  return 0.9 - (1.8 * rang) / Math.max(1, n - 1) + (r - 0.5) * 0.3;
}

function poisson(k: number, l: number): number {
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i++) p *= l / i;
  return p;
}

function tirerPoisson(l: number, rnd: () => number): number {
  const L = Math.exp(-l);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rnd();
  } while (p > L);
  return k - 1;
}

function normale(rnd: () => number): number {
  const u = Math.max(rnd(), 1e-12);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface Modele {
  marches: { key: "h2h" | "totals"; point?: number; issues: { name: string; p: number }[] }[];
  tirerScore: (rnd: () => number) => [number, number];
}

function modeleFoot(home: string, away: string, rangDom: number, rangExt: number, n: number): Modele {
  const d = force(home, rangDom, n) - force(away, rangExt, n);
  const lh = Math.exp(0.3 + 0.55 * d + 0.12);
  const la = Math.exp(0.3 - 0.55 * d);
  let ph = 0;
  let pd = 0;
  let pa = 0;
  let pOver = 0;
  for (let i = 0; i <= 10; i++)
    for (let j = 0; j <= 10; j++) {
      const p = poisson(i, lh) * poisson(j, la);
      if (i > j) ph += p;
      else if (i === j) pd += p;
      else pa += p;
      if (i + j > 2.5) pOver += p;
    }
  const t = ph + pd + pa;
  return {
    marches: [
      { key: "h2h", issues: [{ name: home, p: ph / t }, { name: "Draw", p: pd / t }, { name: away, p: pa / t }] },
      { key: "totals", point: 2.5, issues: [{ name: "Over", p: pOver / t }, { name: "Under", p: 1 - pOver / t }] },
    ],
    tirerScore: (rnd) => [tirerPoisson(lh, rnd), tirerPoisson(la, rnd)],
  };
}

function modeleBasket(home: string, away: string, rangDom: number, rangExt: number, n: number): Modele {
  const d = force(home, rangDom, n) - force(away, rangExt, n);
  const mh = 113 + 7 * d + 1.5;
  const ma = 113 - 7 * d - 1.5;
  const s = 12 * Math.SQRT2;
  const ph = phi((mh - ma) / s);
  const ligne = Math.round(mh + ma) + 0.5;
  const pOver = 1 - phi((ligne - (mh + ma)) / s);
  return {
    marches: [
      { key: "h2h", issues: [{ name: home, p: ph }, { name: away, p: 1 - ph }] },
      { key: "totals", point: ligne, issues: [{ name: "Over", p: pOver }, { name: "Under", p: 1 - pOver }] },
    ],
    tirerScore: (rnd) => {
      let h = Math.round(mh + 12 * normale(rnd));
      let a = Math.round(ma + 12 * normale(rnd));
      if (h === a) rnd() < ph ? (h += 5) : (a += 5);
      return [h, a];
    },
  };
}

function modeleTennis(home: string, away: string, rangDom: number, rangExt: number, n: number): Modele {
  const d = force(home, rangDom, n) - force(away, rangExt, n);
  const ph = 1 / (1 + Math.exp(-2.2 * d));
  return {
    marches: [{ key: "h2h", issues: [{ name: home, p: ph }, { name: away, p: 1 - ph }] }],
    tirerScore: (rnd) => {
      const gagneDom = rnd() < ph;
      const perdant = rnd() < 0.6 ? 0 : 1;
      return gagneDom ? [2, perdant] : [perdant, 2];
    },
  };
}

function coter(issues: { name: string; p: number }[], book: (typeof BOOKS)[number], rnd: () => number, boost: boolean): { name: string; price: number }[] {
  const bruites = issues.map((i) => {
    const l = Math.log(i.p / (1 - i.p)) + book.bruit * normale(rnd);
    return 1 / (1 + Math.exp(-l));
  });
  const t = bruites.reduce((s, x) => s + x, 0);
  const ps = bruites.map((x) => x / t);
  const marge = book.marge * (0.8 + 0.4 * rnd());
  // Marge appliquée « en puissance » comme le font les bookmakers : plus lourde sur les outsiders.
  let lo = 0.5;
  let hi = 1;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (ps.reduce((s, x) => s + x ** mid, 0) > 1 + marge) lo = mid;
    else hi = mid;
  }
  const k0 = (lo + hi) / 2;
  return issues.map((iss, k) => {
    let price = 1 / ps[k] ** k0;
    if (boost && k === 0) price *= 1.12;
    price = Math.max(1.01, Math.floor(price * 100) / 100);
    return { name: iss.name, price };
  });
}

interface MatchDemo {
  event: SportEvent;
  modele: Modele;
  graine: number;
}

function matchsDuJour(ligue: Ligue, jour: number): MatchDemo[] {
  const date = new Date(jour * JOUR);
  if (!ligue.jours.includes(date.getUTCDay())) return [];
  const rnd = prng(hash(`${ligue.key}:${jour}`));
  const n = ligue.parJour[0] + Math.floor(rnd() * (ligue.parJour[1] - ligue.parJour[0] + 1));
  const equipes = [...ligue.equipes].map((e, i) => ({ e, i, r: rnd() })).sort((a, b) => a.r - b.r);
  const out: MatchDemo[] = [];
  for (let k = 0; k < n && 2 * k + 1 < equipes.length; k++) {
    const h = equipes[2 * k];
    const a = equipes[2 * k + 1];
    const heure = ligue.heures[Math.floor(rnd() * ligue.heures.length)];
    const minute = rnd() < 0.5 ? 0 : 30;
    const commence = new Date(jour * JOUR + heure * 3_600_000 + minute * 60_000).toISOString();
    const modele =
      (ligue.type === "foot" ? modeleFoot : ligue.type === "basket" ? modeleBasket : modeleTennis)(h.e, a.e, h.i, a.i, ligue.equipes.length);
    const id = `demo-${ligue.key}-${jour}-${k}`;
    const graine = hash(id);
    const rb = prng(graine);
    const bookmakers: Bookmaker[] = BOOKS.map((b) => {
      const markets: BookMarket[] = modele.marches.map((m) => ({
        key: m.key,
        outcomes: coter(m.issues, b, rb, b.key === "winamax_fr" && rb() < 0.03).map((o) => ({ ...o, ...(m.point !== undefined ? { point: m.point } : {}) })),
      }));
      return { key: b.key, title: b.title, markets, ...(b.key === "winamax_fr" ? { link: "https://www.winamax.fr/paris-sportifs" } : {}) };
    });
    out.push({ event: { id, sportKey: ligue.key, sportTitle: ligue.titre, commence, home: h.e, away: a.e, bookmakers }, modele, graine });
  }
  return out;
}

function matchsFenetre(sports: string[], maintenant: number, avant: number, apres: number): MatchDemo[] {
  const j0 = Math.floor(maintenant / JOUR);
  const out: MatchDemo[] = [];
  for (const l of LIGUES) {
    if (sports.length && !sports.includes(l.key)) continue;
    for (let j = j0 - avant; j <= j0 + apres; j++) out.push(...matchsDuJour(l, j));
  }
  return out;
}

export function sportsDemo() {
  return LIGUES.map((l) => ({ key: l.key, group: l.type === "foot" ? "Soccer" : l.type === "basket" ? "Basketball" : "Tennis", title: l.titre, active: true, outrights: false }));
}

export function coteDemo(sports: string[], maintenant = Date.now()): SportEvent[] {
  return matchsFenetre(sports, maintenant, 0, 16)
    .map((m) => m.event)
    .filter((e) => Date.parse(e.commence) > maintenant)
    .sort((a, b) => a.commence.localeCompare(b.commence));
}

export function scoresDemo(sports: string[], maintenant = Date.now(), joursAvant = 3): ScoreEvent[] {
  return matchsFenetre(sports, maintenant, joursAvant, 0)
    .filter((m) => Date.parse(m.event.commence) < maintenant)
    .map((m) => {
      const fini = Date.parse(m.event.commence) + 2.5 * 3_600_000 < maintenant;
      const [h, a] = m.modele.tirerScore(prng(m.graine ^ 0x9e3779b9));
      return {
        id: m.event.id,
        sportKey: m.event.sportKey,
        commence: m.event.commence,
        completed: fini,
        home: m.event.home,
        away: m.event.away,
        scores: fini ? [{ name: m.event.home, score: h }, { name: m.event.away, score: a }] : null,
      };
    });
}
