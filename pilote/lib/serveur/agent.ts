// L'agent autonome : appelé toutes les 15 minutes (cron), il prépare le plan du jour, envoie le récapitulatif
// du matin si l'application n'a pas été ouverte, puis prévient à chaque heure de jeu.
// Ce module ne dépend d'aucun service : les cotes et les scores lui sont fournis, ce qui le rend testable.

import type { EtatApp, ScoreEvent, SportEvent } from "../types";
import { calculerBankroll, protections } from "../engine/bankroll";
import { planDuJour, recapDepuis, type Plan } from "../engine/conseiller";
import { reglerParis } from "../engine/reglement";
import { construireSelections } from "../engine/valeur";
import { aHeure, cleJour, parties } from "../engine/temps";
import { eur } from "../format";

export interface SessionResumee {
  id: string;
  heure: string;
  libelle: string;
  nb: number;
  total: number;
  envoye?: boolean;
}

export interface PlanResume {
  jour: string;
  verdict: Plan["verdict"];
  message: string;
  sessions: SessionResumee[];
  calculeLe: string;
  source: "client" | "serveur";
}

export interface MetaProfil {
  derniereOuverture?: string;
  matinEnvoye?: string;
  plan?: PlanResume;
}

export interface NotificationAgent {
  titre: string;
  texte: string;
  url: string;
  tag: string;
  actions?: { action: string; title: string }[];
  urlAction?: string;
}

export interface Dependances {
  cotes: (sports: string[], marches: EtatApp["reglages"]["marches"]) => Promise<SportEvent[]>;
  scores: (sports: string[]) => Promise<ScoreEvent[]>;
}

export function resumerPlan(plan: Plan, jour: string, source: PlanResume["source"], maintenant: number): PlanResume {
  return {
    jour,
    verdict: plan.verdict,
    message: plan.message,
    sessions: plan.sessions.map((s) => ({ id: s.id, heure: s.heure, libelle: s.libelle, nb: s.items.length, total: Math.round(s.total * 100) / 100 })),
    calculeLe: new Date(maintenant).toISOString(),
    source,
  };
}

/** Conserve les drapeaux « déjà notifié » quand un nouveau plan remplace l'ancien. */
export function fusionnerPlans(ancien: PlanResume | undefined, nouveau: PlanResume): PlanResume {
  if (!ancien || ancien.jour !== nouveau.jour) return nouveau;
  const envoyes = new Set(ancien.sessions.filter((s) => s.envoye).map((s) => s.id));
  return { ...nouveau, sessions: nouveau.sessions.map((s) => (envoyes.has(s.id) ? { ...s, envoye: true } : s)) };
}

function phrasePlan(p: PlanResume): string {
  if (p.verdict !== "jouer" || p.sessions.length === 0) return "Aujourd'hui, pas d'indice de confiance assez élevé pour jouer : on se repose.";
  const n = p.sessions.reduce((t, s) => t + s.nb, 0);
  const total = p.sessions.reduce((t, s) => t + s.total, 0);
  const premiere = p.sessions[0];
  const quand = premiere.id.endsWith("maintenant") ? "à jouer dès maintenant" : `premier rendez-vous à ${premiere.libelle}`;
  return `Aujourd'hui : ${n} pari${n > 1 ? "s" : ""} prévu${n > 1 ? "s" : ""} (${eur(total)}), ${quand}.`;
}

export async function tacheProfil(
  etat: EtatApp,
  metaInitiale: MetaProfil,
  maintenant: number,
  deps: Dependances,
): Promise<{ notifications: NotificationAgent[]; meta: MetaProfil }> {
  const meta: MetaProfil = { ...metaInitiale, plan: metaInitiale.plan ? { ...metaInitiale.plan, sessions: metaInitiale.plan.sessions.map((s) => ({ ...s })) } : undefined };
  const r = etat.reglages;
  const tz = r.conseiller.fuseau;
  const jour = cleJour(maintenant, tz);
  const heure = parties(maintenant, tz).heure;
  const notifications: NotificationAgent[] = [];

  // 1. Le matin : plan du jour (si l'appli ne l'a pas déjà calculé) et récapitulatif de la nuit.
  if (heure >= r.conseiller.heureRecap && heure < 21 && meta.matinEnvoye !== jour) {
    meta.matinEnvoye = jour;
    let parisAJour = etat.paris;
    const enAttente = etat.paris.filter((p) => p.statut === "en_cours" && p.jambes.some((j) => j.statut === "en_cours" && Date.parse(j.commence) + 2 * 3_600_000 < maintenant));
    if (enAttente.length) {
      try {
        const sc = await deps.scores([...new Set(enAttente.flatMap((p) => p.jambes.map((j) => j.sportKey)))]);
        const regles = new Map(reglerParis(enAttente, sc, maintenant).map((p) => [p.id, p]));
        parisAJour = etat.paris.map((p) => regles.get(p.id) ?? p);
      } catch {
        /* résultats indisponibles : récap partiel */
      }
    }
    if (meta.plan?.jour !== jour) {
      const events = await deps.cotes(r.sports, r.marches);
      const selections = construireSelections(events, { maintenant });
      const etatAJour = { ...etat, paris: parisAJour };
      const bk = calculerBankroll(etatAJour);
      const ctx = { reglages: r, poches: bk.poches, total: bk.total, protections: protections(r, parisAJour, bk, maintenant) };
      meta.plan = fusionnerPlans(meta.plan, resumerPlan(planDuJour(selections, ctx, parisAJour, maintenant), jour, "serveur", maintenant));
      // Les paris « maintenant » sont annoncés dans la notification du matin.
      for (const s of meta.plan.sessions) if (s.id.endsWith("maintenant")) s.envoye = true;
    }
    const ouvertCeMatin = !!meta.derniereOuverture && Date.parse(meta.derniereOuverture) >= aHeure(maintenant, tz, Math.max(0, r.conseiller.heureRecap - 2), 0);
    if (!ouvertCeMatin) {
      const depuis = meta.derniereOuverture ? Date.parse(meta.derniereOuverture) : maintenant - 24 * 3_600_000;
      const recap = recapDepuis(parisAJour, depuis, maintenant, tz);
      notifications.push({
        titre: recap ? `☀️ ${recap.periode} : ${recap.profit >= 0 ? "+" : "−"}${eur(Math.abs(recap.profit))}` : "☀️ Ton plan du jour",
        texte: [recap?.message, phrasePlan(meta.plan!)].filter(Boolean).join(" "),
        url: "/",
        tag: `matin-${jour}`,
      });
    }
  }

  // 2. Les heures de jeu.
  if (meta.plan?.jour === jour) {
    for (const s of meta.plan.sessions) {
      if (s.envoye) continue;
      const t = Date.parse(s.heure);
      if (s.id.endsWith("maintenant") || t > maintenant + 2 * 60_000) continue;
      s.envoye = true;
      if (t < maintenant - 45 * 60_000) continue; // trop tard : le match approche, on ne réveille pas pour rien
      notifications.push({
        titre: `⏰ ${s.libelle} : c'est l'heure de jouer`,
        texte: `${s.nb} pari${s.nb > 1 ? "s" : ""} prêt${s.nb > 1 ? "s" : ""} pour ${eur(s.total)}. Touche pour les valider en un clic.`,
        url: `/?session=${encodeURIComponent(s.id)}`,
        tag: s.id,
        actions: [{ action: "valider", title: "Valider" }],
        urlAction: `/?session=${encodeURIComponent(s.id)}&valider=1`,
      });
    }
  }

  return { notifications, meta };
}
