// Types partagés entre le serveur (récupération des cotes) et le client (moteur + interface).

export type MarketKey = "h2h" | "totals" | "spreads";

export interface BookOutcome {
  name: string;
  price: number;
  point?: number;
  link?: string;
  sid?: string; // identifiant de l'issue chez le bookmaker
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
  sid?: string; // identifiant du match chez le bookmaker
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
  lien?: string; // lien Winamax direct (match ou ticket) quand il est connu
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
  miseConseillee?: number; // mise de la gestion de bankroll, avant décision du conseiller
  boost?: number; // multiplicateur décidé par le conseiller (1 = conseil de gestion)
  demo?: boolean; // pari enregistré pendant le mode démo
  preuve?: PreuveWinamax; // ticket Winamax (numéro et/ou photo)
  note?: string;
}

export interface PreuveWinamax {
  numero?: string; // référence du ticket Winamax
  photo?: string; // adresse de la photo (/api/preuve/…)
  empreinte?: string; // SHA-256 de la photo, inscrit dans le journal
  ajouteeLe: string;
}

/** Relevé de solde : le solde affiché par Winamax comparé à celui calculé par Pilote. */
export interface ReleveSolde {
  id: string;
  date: string;
  soldeWinamax: number;
  soldePilote: number; // disponible calculé par Pilote au même moment
  photo?: string;
  empreinte?: string;
}

/** Cote de clôture d'une sélection, relevée juste avant le coup d'envoi. */
export interface Cloture {
  cote: number | null; // cote Winamax à la clôture
  probaJuste: number; // probabilité juste (consensus, marge retirée) à la clôture
  releveLe: string;
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

export interface ReglagesConseiller {
  conviction: boolean; // le conseiller peut monter la mise quand l'indice et la cote le justifient
  boostMax: number; // multiplicateur maximum de la mise de gestion (toujours sous le plafond de sécurité)
  attendreCompos: boolean; // football : attendre les compositions officielles avant de jouer
  combineDuJour: boolean; // ajouter le meilleur combiné « Objectif cote » au plan du jour
  analyseAuto: boolean; // afficher automatiquement l'analyse complète de l'IA
  modeSimple: boolean; // interface épurée : lire et cliquer
  heureRecap: number; // heure du récapitulatif du matin (0-23)
  fuseau: string; // fuseau horaire IANA
}

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
  conseiller: ReglagesConseiller;
}

export interface EtatApp {
  version: 1;
  profilId: string; // identifiant anonyme pour la synchronisation et les notifications
  reglages: Reglages;
  paris: Pari[];
  mouvements: Mouvement[];
  onboarding: boolean;
  derniereVisite: string | null; // pour le récapitulatif « pendant ton absence »
  releves?: ReleveSolde[];
  majLe: string;
}

// ---------------------------------------------------------------------------
// Analyse IA d'un match

export type VerdictIA = "confirmer" | "prudence" | "eviter";

export interface AnalyseIA {
  verdict: VerdictIA;
  resume: string;
  pointsForts: string[];
  pointsFaibles: string[];
  infosCles: string[];
  avisMise: string;
  attendreCompositions: boolean;
  confianceAnalyste: number;
  sources: { titre: string; url: string }[];
  genereLe: string;
  modele: string;
}
