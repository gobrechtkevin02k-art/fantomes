// Les offres d'abonnement et les fonctionnalités qu'elles débloquent (partagé client / serveur).

export type Offre = "decouverte" | "essentiel" | "pro" | "elite";

export interface Droits {
  parisParJour: number; // paris Classique conseillés par jour (Infinity = illimité)
  conseiller: boolean; // plan du jour complet, heures de jeu, « on ne joue pas aujourd'hui »
  notifMatin: boolean; // récapitulatif du matin
  notifHeureJeu: boolean; // notification à chaque heure de jeu + validation en un clic
  tempsReel: boolean; // résultats en temps réel, bankroll et mises recalculées, notification
  conviction: boolean; // le conseiller peut relever la mise
  analysesIAParJour: number; // nouvelles analyses IA par jour (les analyses déjà en cache sont gratuites)
  direct: boolean; // suivi en direct et conseil de cash-out
  objectifCote: boolean; // mode fun « Objectif cote »
  jackpot: boolean; // mode fun « Jackpot »
  synchro: boolean; // synchronisation multi-appareils
}

export interface DefinitionOffre {
  id: Offre;
  nom: string;
  prix: number; // en centimes, par mois
  accroche: string;
  couleur: string;
  droits: Droits;
  points: string[];
}

export const ORDRE_OFFRES: Offre[] = ["decouverte", "essentiel", "pro", "elite"];

export const OFFRES: Record<Offre, DefinitionOffre> = {
  decouverte: {
    id: "decouverte",
    nom: "Découverte",
    prix: 0,
    accroche: "Pour essayer la méthode",
    couleur: "#8b97a4",
    droits: {
      parisParJour: 1,
      conseiller: false,
      notifMatin: false,
      notifHeureJeu: false,
      tempsReel: false,
      conviction: false,
      analysesIAParJour: 0,
      direct: false,
      objectifCote: false,
      jackpot: false,
      synchro: false,
    },
    points: ["1 pari Classique conseillé par jour", "Mise calculée selon ta bankroll", "Suivi de bankroll et objectif", "Garde-fous (stop-loss, pause)"],
  },
  essentiel: {
    id: "essentiel",
    nom: "Essentiel",
    prix: 499,
    accroche: "Le conseiller au quotidien",
    couleur: "#34d399",
    droits: {
      parisParJour: 2,
      conseiller: true,
      notifMatin: true,
      notifHeureJeu: false,
      tempsReel: false,
      conviction: false,
      analysesIAParJour: 1,
      direct: false,
      objectifCote: false,
      jackpot: false,
      synchro: true,
    },
    points: ["2 paris Classique par jour", "Plan du jour et heures de jeu", "Récap du matin à 7h", "1 analyse IA par jour", "Synchronisation multi-appareils"],
  },
  pro: {
    id: "pro",
    nom: "Pro",
    prix: 999,
    accroche: "L'agent qui joue avec toi",
    couleur: "#a78bfa",
    droits: {
      parisParJour: 5,
      conseiller: true,
      notifMatin: true,
      notifHeureJeu: true,
      tempsReel: true,
      conviction: true,
      analysesIAParJour: 5,
      direct: false,
      objectifCote: true,
      jackpot: false,
      synchro: true,
    },
    points: [
      "5 paris Classique par jour",
      "Notification à l'heure de jeu, validation en 1 clic",
      "Résultats en temps réel, mises recalculées",
      "Mise relevée sur les cotes exceptionnelles",
      "5 analyses IA par jour",
      "Mode Objectif cote",
    ],
  },
  elite: {
    id: "elite",
    nom: "Élite",
    prix: 1999,
    accroche: "Tout débloqué",
    couleur: "#fbbf24",
    droits: {
      parisParJour: Infinity,
      conseiller: true,
      notifMatin: true,
      notifHeureJeu: true,
      tempsReel: true,
      conviction: true,
      analysesIAParJour: 20,
      direct: true,
      objectifCote: true,
      jackpot: true,
      synchro: true,
    },
    points: [
      "Paris Classique illimités",
      "Suivi en direct et conseil de cash-out",
      "20 analyses IA par jour",
      "Tous les modes, Jackpot compris",
      "Tout ce que contient Pro",
    ],
  },
};

export const droitsDe = (o: Offre): Droits => OFFRES[o].droits;

export const estOffre = (x: unknown): x is Offre => typeof x === "string" && (ORDRE_OFFRES as string[]).includes(x);

/** La première offre qui débloque une fonctionnalité (pour les messages « Débloquer avec… »). */
export function offrePour(test: (d: Droits) => boolean): DefinitionOffre {
  const o = ORDRE_OFFRES.find((x) => test(OFFRES[x].droits)) ?? "elite";
  return OFFRES[o];
}

export const prixMensuel = (o: Offre) =>
  OFFRES[o].prix === 0 ? "Gratuit" : `${(OFFRES[o].prix / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €/mois`;

export interface EtatAbonnement {
  offre: Offre;
  statut: "aucun" | "actif" | "annule" | "impaye";
  finPeriode: string | null;
  geste?: "complet" | "defaut"; // accès donné par la configuration (propriétaire, tests)
}
