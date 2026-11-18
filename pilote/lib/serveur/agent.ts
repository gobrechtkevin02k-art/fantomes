// L'agent autonome : appelé toutes les 15 minutes (cron), il prépare le plan du jour, envoie le récapitulatif
// du matin si l'application n'a pas été ouverte, puis prévient à chaque heure de jeu.
// Ce module ne dépend d'aucun service : les cotes et les scores lui sont fournis, ce qui le rend testable.

import type { EtatApp, ScoreEvent, SportEvent } from "../types";
import { calculerBankroll, protections } from "../engine/bankroll";
import { planDuJour, recapDepuis, type Plan } from "../engine/conseiller";
import { reglerParis } from "../engine/reglement";
import { construireSelections } from "../engine/valeur";
import { aHeure, cleJour, parties } from "../engine/temps";
import { evaluerPariDirect, titreConseil, type Conseil } from "../engine/direct";
import { droitsDe, type Droits } from "../offres";
import { eur, eurSigne } from "../format";

export interface SessionResumee {
  id: string;
  heure: string;
  libelle: string;
  nb: number;
  total: number;
  boostes?: number;
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
  reglesNotifies?: string[]; // paris dont le résultat a déjà été notifié
  alertesDirect?: Record<string, Conseil>; // dernier conseil de cash-out notifié par pari
  rappelSynchro?: string; // jour du dernier rappel de synchronisation (compte public)
}

export interface NotificationAgent {
  titre: string;
  texte: string;
  url: string;
  tag: string;
  actions?: { action: string; title: string }[];
  urlAction?: string;
  badge?: number;
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
    sessions: plan.sessions.map((s) => ({
      id: s.id,
      heure: s.heure,
      libelle: s.libelle,
      nb: s.items.length,
      total: Math.round(s.total * 100) / 100,
      boostes: s.items.filter((i) => i.boost > 1.001).length,
    })),
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
  if (p.verdict === "limite") return "Tu as atteint la limite de paris de ton offre pour aujourd'hui.";
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
  droits: Droits = droitsDe("elite"),
): Promise<{ notifications: NotificationAgent[]; meta: MetaProfil }> {
  const meta: MetaProfil = {
    ...metaInitiale,
    plan: metaInitiale.plan ? { ...metaInitiale.plan, sessions: metaInitiale.plan.sessions.map((s) => ({ ...s })) } : undefined,
    reglesNotifies: [...(metaInitiale.reglesNotifies ?? [])],
    alertesDirect: { ...(metaInitiale.alertesDirect ?? {}) },
  };
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
      const plan = planDuJour(selections, ctx, parisAJour, maintenant, { limiteParJour: droits.parisParJour, conviction: droits.conviction });
      meta.plan = fusionnerPlans(meta.plan, resumerPlan(plan, jour, "serveur", maintenant));
      // Les paris « maintenant » sont annoncés dans la notification du matin.
      for (const s of meta.plan.sessions) if (s.id.endsWith("maintenant")) s.envoye = true;
    }
    const ouvertCeMatin = !!meta.derniereOuverture && Date.parse(meta.derniereOuverture) >= aHeure(maintenant, tz, Math.max(0, r.conseiller.heureRecap - 2), 0);
    if (!ouvertCeMatin && droits.notifMatin) {
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
  if (meta.plan?.jour === jour && droits.notifHeureJeu) {
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
        badge: s.nb,
      });
    }
  }

  // 3. Le temps réel (mode Classique uniquement) : résultats, bankroll recalculée, conseils pendant le match.
  if (droits.tempsReel || droits.direct) {
    const suivis = etat.paris.filter((p) => p.mode === "classique" && p.statut === "en_cours" && p.jambes.some((j) => j.statut === "en_cours" && Date.parse(j.commence) <= maintenant));
    if (suivis.length) {
      const sports = [...new Set(suivis.flatMap((p) => p.jambes.map((j) => j.sportKey)))];
      const sc = await deps.scores(sports).catch(() => []);
      const regles = new Map(reglerParis(suivis, sc, maintenant).map((p) => [p.id, p]));
      const parisAJour = etat.paris.map((p) => regles.get(p.id) ?? p);
      const bk = calculerBankroll({ ...etat, paris: parisAJour });

      if (droits.tempsReel) {
        for (const p of regles.values()) {
          if (p.statut === "en_cours" || meta.reglesNotifies!.includes(p.id)) continue;
          meta.reglesNotifies!.push(p.id);
          const nom = p.jambes.length > 1 ? `Combiné à ${p.jambes.length} sélections` : p.jambes[0]?.label ?? "Pari";
          const profit = (p.gain ?? 0) - p.mise;
          const prochaine = meta.plan?.jour === jour ? meta.plan.sessions.find((s) => !s.envoye && Date.parse(s.heure) > maintenant) : undefined;
          let suite: string;
          if (p.statut === "perdu") {
            suite = " Je ne cours pas après la perte : la prochaine mise suit la bankroll, elle baisse donc un peu.";
            if (prochaine) suite += prochaine.boostes ? ` Prochain rendez-vous à ${prochaine.libelle}, et c'est une vraie occasion : mise relevée car la cote est exceptionnelle.` : ` Prochain rendez-vous à ${prochaine.libelle}, mise normale.`;
            else suite += " Rien d'autre d'assez solide aujourd'hui.";
          } else if (p.statut === "gagne") {
            suite = " Les prochaines mises sont recalculées sur ce nouveau montant." + (prochaine ? ` Prochain rendez-vous à ${prochaine.libelle}.` : "");
          } else suite = "";
          notifications.push({
            titre: p.statut === "gagne" ? `✅ Gagné : ${eurSigne(profit)}` : p.statut === "perdu" ? `❌ Perdu : ${eurSigne(profit)}` : "↩️ Pari remboursé",
            texte: `${nom} à ${p.cote.toFixed(2).replace(".", ",")}. Bankroll : ${eur(bk.total)}.${suite}`,
            url: "/suivi",
            tag: `resultat-${p.id}`,
          });
        }
        meta.reglesNotifies = meta.reglesNotifies!.slice(-200);
      }

      if (droits.direct) {
        const encore = suivis.filter((p) => (regles.get(p.id)?.statut ?? "en_cours") === "en_cours").map((p) => regles.get(p.id) ?? p);
        if (encore.length) {
          const events = await deps.cotes(sports, etat.reglages.marches).catch(() => []);
          for (const p of encore) {
            const e = evaluerPariDirect(p, sc, events, maintenant, bk.total);
            if (!e || e.conseil === "garder" || meta.alertesDirect![p.id] === e.conseil) continue;
            meta.alertesDirect![p.id] = e.conseil;
            notifications.push({ titre: titreConseil(e, p), texte: e.message, url: "/?direct=1", tag: `direct-${p.id}` });
          }
        }
      }
    }
  }

  return { notifications, meta };
}
