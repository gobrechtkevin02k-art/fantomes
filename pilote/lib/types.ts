// Types partagés entre le serveur (récupération des cotes) et le client (moteur + interface).

export type MarketKey = "h2h" | "totals" | "spreads";

export interface BookOutcome {
  name: string;
  price: number;
  point?: number;
  link?: string;
}

export interface BookMarket {
  key: MarketKey;
  outcomes: BookOutcome[];
  link?: string;
}

export interface Bookmaker {
  key: string;
  title: string;
  markets: BookMarket[];
  link?: string;
}

export interface SportEvent {
  id: string;
  sportKey: string;
  sportTitle: string;
  commence: string; // ISO 8601
  home: string;
  away: string;
  bookmakers: Bookmaker[];
}

export interface ScoreEvent {
  id: string;
  sportKey: string;
  commence: string;
  completed: boolean;
  home: string;
  away: string;
  scores: { name: string; score: number }[] | null;
}

export interface Quota {
  remaining: number | null;
  used: number | null;
}

export interface OddsResponse {
  source: "live" | "demo";
  fetchedAt: string;
  events: SportEvent[];
  quota: Quota;
  errors: string[];
}

export interface ScoresResponse {
  source: "live" | "demo";
  fetchedAt: string;
  scores: ScoreEvent[];
  errors: string[];
}

export interface SportInfo {
  key: string;
  group: string;
  title: string;
  active: boolean;
  outrights: boolean;
}

// ---------------------------------------------------------------------------
// Sorties du moteur

export interface FacteursConfiance {
  marche: number; // profondeur du marché (nombre de bookmakers, présence d'un bookmaker « sharp »)
  accord: number; // accord entre bookmakers
  delai: number; // fiabilité liée au délai avant le match
  niveau: number; // fiabilité liée au niveau de cote (les très grosses cotes sont plus incertaines)
}

export interface Selection {
  id: string; // `${eventId}|${ligne}|${issue}`
  eventId: string;
  sportKey: string;
  sportTitle: string;
  commence: string;
  home: string;
  away: string;
  market: MarketKey;
  ligne: string; // clé de ligne (ex. "totals:2.5")
  issue: string; // nom brut de l'issue (équipe, "Draw", "Over"...)
  point?: number;
  label: string; // libellé lisible en français
  odds: number; // cote Winamax
  fairProb: number; // probabilité « juste » estimée à partir du consensus
  fairOdds: number;
  impliedProb: number; // 1 / cote Winamax
  edge: number; // espérance de gain par euro misé : fairProb * odds - 1
  sigma: number; // incertitude (écart-type en log-cote) sur fairProb
  confidence: number; // 0-100 : probabilité, selon le modèle, que le pari ait une espérance positive
  facteurs: FacteursConfiance;
  books: number; // nombre de bookmakers utilisés pour le consensus
  sharp: boolean;
  suspect: boolean; // avantage anormalement élevé : cote probablement erronée ou marché différent
  link?: string;
}

export type Mode = "classique" | "objectif" | "jackpot";

export type StatutPari = "en_cours" | "gagne" | "perdu" | "rembourse" | "cashout";
export type StatutJambe = "en_cours" | "gagne" | "perdu" | "rembourse";

export interface Jambe {
  selectionId: string;
  eventId: string;
  sportKey: string;
  sportTitle: string;
  commence: string;
  home: string;
  away: string;
  market: MarketKey;
  issue: string;
  point?: number;
  label: string;
  odds: number;
  fairProb: number;
  statut: StatutJambe;
}

export interface Pari {
  id: string;
  creeLe: string;
  mode: Mode;
  jambes: Jambe[];
  cote: number; // cote totale réellement obtenue
  mise: number;
  confiance: number;
  edge: number; // espérance estimée au moment du pari
  probaEstimee: number;
  statut: StatutPari;
  gain?: number; // montant total retourné (mise incluse) une fois réglé
  regleLe?: string;
  auto?: boolean; // réglé automatiquement via les résultats
  demo?: boolean; // pari enregistré pendant le mode démo
  note?: string;
}

export type TypeMouvement = "depot" | "retrait" | "ajustement" | "reequilibrage";

export interface Mouvement {
  id: string;
  date: string;
  type: TypeMouvement;
  montant: number; // positif = entrée, négatif = sortie (0 pour un rééquilibrage)
  note?: string;
}

export type Profil = "prudent" | "equilibre" | "offensif";

export interface Reglages {
  bankrollInitiale: number;
  dateDebut: string;
  allocation: Record<Mode, number>; // pourcentages, total = 100
  profil: Profil;
  objectif: { montant: number; date: string } | null;
  stopLossJour: number; // % de la bankroll
  stopLossSemaine: number; // % de la bankroll
  expositionMax: number; // % de la bankroll engagée simultanément
  miseMin: number;
  arrondi: number;
  sports: string[];
  marches: MarketKey[];
  classique: { coteMin: number; coteMax: number; confianceMin: number; edgeMin: number };
  objectifCote: { cible: number; horizonJours: number; jambesMax: number; coteJambeMax: number; confianceMin: number };
  jackpot: { coteMin: number; cibleCombo: number; misePct: number };
  pause: string | null; // date de fin d'une pause volontaire
}

export interface EtatApp {
  version: 1;
  reglages: Reglages;
  paris: Pari[];
  mouvements: Mouvement[];
  onboarding: boolean;
}
