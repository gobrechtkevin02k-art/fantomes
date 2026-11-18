// Scores des matchs passés (football) : fichiers CSV gratuits de football-data.co.uk,
// rapprochés des matchs de The Odds API par date et par ressemblance des noms d'équipes.

export interface ResultatCsv {
  date: string; // AAAA-MM-JJ
  home: string;
  away: string;
  butsDom: number;
  butsExt: number;
}

/** Codes des championnats sur football-data.co.uk. */
export const CODES_FOOTBALL_DATA: Record<string, string> = {
  soccer_epl: "E0",
  soccer_spain_la_liga: "SP1",
  soccer_italy_serie_a: "I1",
  soccer_germany_bundesliga: "D1",
  soccer_france_ligue_one: "F1",
  soccer_france_ligue_two: "F2",
  soccer_netherlands_eredivisie: "N1",
  soccer_portugal_primeira_liga: "P1",
};

export const sportsAvecResultats = Object.keys(CODES_FOOTBALL_DATA);

/** Saison au format football-data (« 2425 » pour 2024-2025) : une saison commence en juillet. */
export function saison(dateIso: string): string {
  const d = new Date(dateIso);
  const a = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${String(a % 100).padStart(2, "0")}${String((a + 1) % 100).padStart(2, "0")}`;
}

export const urlResultats = (sportKey: string, saisonCode: string) => `https://www.football-data.co.uk/mmz4281/${saisonCode}/${CODES_FOOTBALL_DATA[sportKey]}.csv`;

function decouper(ligne: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const c of ligne) {
    if (c === '"') q = !q;
    else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export function lireCsvResultats(texte: string): ResultatCsv[] {
  const lignes = texte.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lignes.length < 2) return [];
  const entete = decouper(lignes[0]);
  const i = (nom: string) => entete.indexOf(nom);
  const [iDate, iDom, iExt, iBd, iBe] = [i("Date"), i("HomeTeam"), i("AwayTeam"), i("FTHG"), i("FTAG")];
  if ([iDate, iDom, iExt, iBd, iBe].some((x) => x < 0)) return [];
  const out: ResultatCsv[] = [];
  for (const l of lignes.slice(1)) {
    const c = decouper(l);
    const m = c[iDate]?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    const bd = Number(c[iBd]);
    const be = Number(c[iBe]);
    if (!m || c[iBd] === "" || c[iBe] === "" || !Number.isFinite(bd) || !Number.isFinite(be)) continue;
    const annee = m[3].length === 2 ? `20${m[3]}` : m[3];
    out.push({ date: `${annee}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, home: c[iDom], away: c[iExt], butsDom: bd, butsExt: be });
  }
  return out;
}

const MOTS_VIDES = new Set(["fc", "cf", "ac", "as", "sc", "afc", "ssc", "us", "rc", "ud", "cd", "sd", "rcd", "club", "de", "la", "le", "of", "and", "the", "calcio", "1", "05", "04", "1899", "1846", "1907", "1909", "1913"]);
const ALIAS: Record<string, string> = {
  man: "manchester",
  utd: "united",
  nott: "nottingham",
  "nott'm": "nottingham",
  forest: "forest",
  wolves: "wolverhampton",
  spurs: "tottenham",
  psg: "paris saint germain",
  "paris sg": "paris saint germain",
  inter: "inter milan",
  milan: "milan",
  ath: "athletic",
  bilbao: "bilbao",
  sociedad: "sociedad",
  betis: "betis",
  sp: "sporting",
  gladbach: "monchengladbach",
  "m'gladbach": "monchengladbach",
  leverkusen: "leverkusen",
  "ein frankfurt": "eintracht frankfurt",
  "st etienne": "saint etienne",
  "st pauli": "st pauli",
};

export function normaliserNom(nom: string): string[] {
  let s = nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (ALIAS[s]) s = ALIAS[s];
  return s
    .split(" ")
    .map((m) => ALIAS[m] ?? m)
    .join(" ")
    .split(" ")
    .filter((m) => m && !MOTS_VIDES.has(m));
}

/** Ressemblance entre deux noms d'équipe (0 à 1) : mots communs, préfixes compris (« Man » ↔ « Manchester »). */
export function ressemblance(a: string, b: string): number {
  const ma = normaliserNom(a);
  const mb = normaliserNom(b);
  if (!ma.length || !mb.length) return 0;
  if (ma.join(" ") === mb.join(" ")) return 1;
  let communs = 0;
  for (const x of ma) if (mb.some((y) => y === x || (x.length >= 3 && y.startsWith(x)) || (y.length >= 3 && x.startsWith(y)))) communs++;
  return communs / Math.max(ma.length, mb.length);
}

/** Trouve le score d'un match : même jour (± 1 jour, fuseaux horaires) et noms les plus proches. */
export function trouverResultat(m: { commence: string; home: string; away: string }, resultats: ResultatCsv[]): ResultatCsv | null {
  const jour = Date.parse(m.commence.slice(0, 10));
  let meilleur: ResultatCsv | null = null;
  let score = 0;
  for (const r of resultats) {
    if (Math.abs(Date.parse(r.date) - jour) > 86_400_000) continue;
    const s = (ressemblance(m.home, r.home) + ressemblance(m.away, r.away)) / 2;
    if (s > score) {
      score = s;
      meilleur = r;
    }
  }
  return score >= 0.5 ? meilleur : null;
}
