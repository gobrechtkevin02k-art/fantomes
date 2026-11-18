// Backtest : rejouer le vrai moteur de Pilote sur des matchs passés.

import type { Bookmaker, Cloture, Pari, Profil } from "../types";

export interface Instantane {
  t: string; // heure à laquelle les cotes ont été relevées
  bookmakers: Bookmaker[];
}

export interface MatchHistorique {
  id: string;
  sportKey: string;
  sportTitle: string;
  commence: string;
  home: string;
  away: string;
  decision: Instantane; // cotes au moment où Pilote décide
  cloture?: Instantane; // cotes juste avant le coup d'envoi
  resultat?: { home: number; away: number };
}

export interface ParametresBacktest {
  bankroll: number;
  profil: Profil;
  conviction: boolean; // le conseiller peut relever les mises
  coteMin: number;
  coteMax: number;
  confianceMin: number;
  edgeMin: number;
}

export const PARAMETRES_DEFAUT: ParametresBacktest = {
  bankroll: 1000,
  profil: "equilibre",
  conviction: true,
  coteMin: 1.3,
  coteMax: 3.2,
  confianceMin: 60,
  edgeMin: 0.01,
};

export interface RapportBacktest {
  source: "reel" | "demo";
  genereLe: string;
  parametres: ParametresBacktest;
  periode: { du: string; au: string };
  sports: string[];
  matchs: number; // matchs avec cotes et résultat
  matchsSansResultat: number; // écartés faute de score (non comptés)
  opportunites: number; // sélections à valeur positive repérées (avant filtres de mise)
  paris: Pari[];
  clotures: Record<string, Cloture>;
  bankrollFinale: number;
  creditsUtilises?: number;
}
