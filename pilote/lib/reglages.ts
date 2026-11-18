// Réglages par défaut (module sans React : utilisable côté serveur, dans les tests et le backtest).

import type { Reglages } from "./types";
import { SPORTS_PAR_DEFAUT } from "./sports";

export function reglagesParDefaut(): Reglages {
  const dans6mois = new Date();
  dans6mois.setMonth(dans6mois.getMonth() + 6);
  return {
    bankrollInitiale: 100,
    dateDebut: new Date().toISOString(),
    allocation: { classique: 80, objectif: 15, jackpot: 5 },
    profil: "equilibre",
    objectif: { montant: 200, date: dans6mois.toISOString().slice(0, 10) },
    stopLossJour: 10,
    stopLossSemaine: 20,
    expositionMax: 15,
    miseMin: 0.1,
    arrondi: 0.1,
    sports: SPORTS_PAR_DEFAUT,
    marches: ["h2h", "totals"],
    classique: { coteMin: 1.3, coteMax: 3.2, confianceMin: 60, edgeMin: 0.01 },
    objectifCote: { cible: 10, horizonJours: 7, jambesMax: 8, coteJambeMax: 3.5, confianceMin: 45 },
    jackpot: { coteMin: 20, cibleCombo: 100, misePct: 2 },
    pause: null,
    conseiller: {
      conviction: true,
      boostMax: 1.5,
      attendreCompos: true,
      combineDuJour: true,
      analyseAuto: false,
      modeSimple: true,
      heureRecap: 7,
      fuseau: fuseauNavigateur(),
    },
  };
}

function fuseauNavigateur(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Paris";
  } catch {
    return "Europe/Paris";
  }
}
