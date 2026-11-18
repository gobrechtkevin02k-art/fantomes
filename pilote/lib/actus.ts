// Actualités et lecture des captures d'écran de l'administrateur (logique partagée, testable).

import type { Pari } from "./types";
import { ressemblance } from "./backtest/resultats";
import { cote as fmtCote, eur, eurSigne } from "./format";

export type StatutLu = "gagne" | "perdu" | "en_cours" | "rembourse" | "cashout" | "inconnu";

export interface PariLu {
  selection: string;
  match: string;
  cote: number | null;
  mise: number | null;
  gain: number | null; // montant total retourné (mise comprise), si visible
  statut: StatutLu;
  numeroTicket: string | null;
  date: string | null;
}

export interface LectureCapture {
  type: "ticket" | "historique" | "solde" | "autre";
  paris: PariLu[];
  solde: number | null;
  confiance: number; // 0-100 : à quel point la lecture est sûre
  remarques: string;
  message: string; // brouillon du message à publier
  modele: string;
}

export interface Bilan {
  gagnes: number;
  perdus: number;
  enCours: number;
  mises: number; // mises des paris réglés
  net: number; // gains − pertes des paris réglés
}

export interface Controle {
  pari: PariLu;
  profit: number | null;
  coherent: boolean;
  probleme?: string;
  correspondance?: { pariId: string; label: string };
}

export interface ResultatControle {
  controles: Controle[];
  bilan: Bilan;
  sure: boolean; // publication automatique possible
  raisons: string[]; // pourquoi une relecture est demandée
}

export const SEUIL_LECTURE_SURE = 85;

function profitDe(p: PariLu): number | null {
  if (p.statut === "perdu") return p.mise !== null ? -p.mise : null;
  if (p.statut === "rembourse") return 0;
  if (p.statut === "gagne") {
    if (p.mise === null) return null;
    const retour = p.gain ?? (p.cote !== null ? p.mise * p.cote : null);
    return retour !== null ? Math.round((retour - p.mise) * 100) / 100 : null;
  }
  if (p.statut === "cashout") return p.mise !== null && p.gain !== null ? Math.round((p.gain - p.mise) * 100) / 100 : null;
  return null;
}

function probleme(p: PariLu): string | undefined {
  if (p.statut === "inconnu") return "Résultat illisible.";
  if (p.statut !== "en_cours" && p.mise === null) return "Mise illisible.";
  if (p.statut === "gagne" && p.gain === null && p.cote === null) return "Ni gain ni cote lisible.";
  if (p.statut === "gagne" && p.gain !== null && p.cote !== null && p.mise !== null) {
    const attendu = p.mise * p.cote;
    if (Math.abs(p.gain - attendu) > Math.max(0.05, attendu * 0.02)) return `Gain lu (${eur(p.gain)}) différent de mise × cote (${eur(attendu)}).`;
  }
  if (p.statut === "cashout" && p.gain === null) return "Montant du cash-out illisible.";
  return undefined;
}

/** Le pari lu correspond-il à un pari du compte (numéro de ticket, ou sélection + cote + mise) ? */
export function correspondance(p: PariLu, paris: Pari[]): Controle["correspondance"] {
  const reels = paris.filter((x) => !x.demo);
  if (p.numeroTicket) {
    const n = p.numeroTicket.replace(/\s/g, "");
    const parNumero = reels.find((x) => x.preuve?.numero?.replace(/\s/g, "") === n);
    if (parNumero) return { pariId: parNumero.id, label: parNumero.jambes[0]?.label ?? "" };
  }
  if (p.cote === null) return undefined;
  let meilleur: Pari | null = null;
  let score = 0;
  for (const x of reels) {
    if (Math.abs(x.cote - p.cote) > 0.06) continue;
    if (p.mise !== null && Math.abs(x.mise - p.mise) > 0.6) continue;
    const j = x.jambes[0];
    if (!j) continue;
    const s = Math.max(ressemblance(p.selection, j.label), ressemblance(p.match, `${j.home} ${j.away}`), ressemblance(p.selection, j.issue));
    if (s > score) {
      score = s;
      meilleur = x;
    }
  }
  return meilleur && score >= 0.5 ? { pariId: meilleur.id, label: meilleur.jambes[0]?.label ?? "" } : undefined;
}

export function controler(lecture: LectureCapture, parisCompte: Pari[]): ResultatControle {
  const controles: Controle[] = lecture.paris.map((p) => {
    const pb = probleme(p);
    return { pari: p, profit: profitDe(p), coherent: !pb, ...(pb ? { probleme: pb } : {}), correspondance: correspondance(p, parisCompte) };
  });
  const regles = controles.filter((c) => c.pari.statut !== "en_cours" && c.profit !== null);
  const bilan: Bilan = {
    gagnes: controles.filter((c) => c.pari.statut === "gagne").length,
    perdus: controles.filter((c) => c.pari.statut === "perdu").length,
    enCours: controles.filter((c) => c.pari.statut === "en_cours").length,
    mises: Math.round(regles.reduce((t, c) => t + (c.pari.mise ?? 0), 0) * 100) / 100,
    net: Math.round(regles.reduce((t, c) => t + (c.profit ?? 0), 0) * 100) / 100,
  };
  const raisons: string[] = [];
  if (!controles.length) raisons.push("Aucun pari reconnu sur la capture.");
  if (lecture.confiance < SEUIL_LECTURE_SURE) raisons.push(`Lecture incertaine (${lecture.confiance}/100).`);
  for (const c of controles) if (c.probleme) raisons.push(`${c.pari.selection || "Un pari"} : ${c.probleme}`);
  if (controles.length && !regles.length) raisons.push("Aucun pari réglé : rien à annoncer en gains ou pertes.");
  return { controles, bilan, sure: raisons.length === 0, raisons };
}

/** Message sobre et factuel, utilisé si l'IA n'est pas disponible. Les pertes sont dites aussi clairement que les gains. */
export function messageParDefaut(r: ResultatControle): string {
  const lignes = r.controles
    .filter((c) => c.pari.statut !== "en_cours")
    .map((c) => {
      const etat = c.pari.statut === "gagne" ? "gagné" : c.pari.statut === "perdu" ? "perdu" : c.pari.statut === "rembourse" ? "remboursé" : c.pari.statut === "cashout" ? "cash-out" : "?";
      return `• ${c.pari.selection}${c.pari.cote ? ` à ${fmtCote(c.pari.cote)}` : ""} : ${etat}${c.profit !== null ? ` (${eurSigne(c.profit)})` : ""}`;
    });
  const b = r.bilan;
  const titre = b.net > 0 ? `Bilan : ${eurSigne(b.net)}` : b.net < 0 ? `Bilan : ${eurSigne(b.net)}` : "Bilan à l'équilibre";
  return `${titre} sur ${b.gagnes + b.perdus} pari${b.gagnes + b.perdus > 1 ? "s" : ""} réglé${b.gagnes + b.perdus > 1 ? "s" : ""} (${b.gagnes} gagné${b.gagnes > 1 ? "s" : ""}, ${b.perdus} perdu${b.perdus > 1 ? "s" : ""}).\n${lignes.join("\n")}`;
}

export type TypeActu = "resultat" | "annonce" | "bilan_auto";

export interface Actu {
  id: string;
  t: string;
  type: TypeActu;
  titre: string;
  texte: string;
  image?: string;
  bilan?: Bilan;
  paris?: { selection: string; cote: number | null; mise: number | null; statut: StatutLu; profit: number | null; verifie: boolean }[];
  auto?: boolean; // publié sans relecture (lecture jugée sûre)
}

export function titreBilan(b: Bilan): string {
  if (b.net > 0) return `✅ ${eurSigne(b.net)} sur ${b.gagnes + b.perdus} pari${b.gagnes + b.perdus > 1 ? "s" : ""}`;
  if (b.net < 0) return `❌ ${eurSigne(b.net)} sur ${b.gagnes + b.perdus} pari${b.gagnes + b.perdus > 1 ? "s" : ""}`;
  return `↔️ Équilibre sur ${b.gagnes + b.perdus} pari${b.gagnes + b.perdus > 1 ? "s" : ""}`;
}
