// Le conseiller : il prend les décisions finales (mise, moment de jouer, jouer ou non)
// et les explique en français, à la première personne.
//
// Règles non négociables : il ne dépasse jamais le plafond de sécurité du profil, ne joue jamais
// pendant un stop-loss ou une pause, et un objectif en retard ne fait jamais monter les mises.

import type { AnalyseIA, Pari, Selection, VerdictIA } from "../types";
import { arrondir, MISE_MAX_PCT, miseObjectif, planClassique, type ContexteMise, type ResultatMise } from "./mise";
import { proposerCombos, type PropositionCombo } from "./combos";
import { poolObjectif } from "./modes";
import { clamp } from "./proba";
import { aHeure, cleJour, debutJour, hhmm, jourRelatif, parties } from "./temps";
import { cote, eur, eurSigne, pct, pctSigne } from "../format";

export interface MouvementCote {
  premiere: number;
  tPremiere: string;
}

export type Action = "jouer" | "attendre" | "passer";
export type RaisonHeure = "imminent" | "cote_genereuse" | "compositions" | "jour_du_match" | "maintenant";

export interface Avis {
  action: Action;
  heure: string;
  raisonHeure: RaisonHeure;
  miseBase: number;
  mise: number;
  boost: number;
  message: string;
  tendance: "hausse" | "baisse" | null;
  verdictIA?: VerdictIA;
}

const MIN = 60_000;
const HEURE = 3_600_000;

function heureCompos(debut: number): number {
  // Les compositions officielles tombent environ une heure avant le coup d'envoi.
  const t = debut - 65 * MIN;
  return t - (t % (5 * MIN));
}

export function avisSelection(
  s: Selection,
  base: ResultatMise,
  ctx: ContexteMise,
  maintenant: number,
  opts: { mouvement?: MouvementCote; analyse?: AnalyseIA } = {},
): Avis {
  const r = ctx.reglages;
  const c = r.conseiller;
  const tz = c.fuseau;
  const debut = Date.parse(s.commence);
  const h = (debut - maintenant) / HEURE;
  const phrases: string[] = [];

  // Tendance de la cote depuis la première fois que Pilote l'a vue.
  let tendance: Avis["tendance"] = null;
  if (opts.mouvement && opts.mouvement.premiere > 1) {
    const d = (s.odds - opts.mouvement.premiere) / opts.mouvement.premiere;
    const depuis = hhmm(Date.parse(opts.mouvement.tPremiere), tz);
    if (d >= 0.02) {
      tendance = "hausse";
      phrases.push(`La cote grimpe (${cote(opts.mouvement.premiere)} → ${cote(s.odds)} depuis ${depuis}) : encore plus de marge pour nous.`);
    } else if (d <= -0.02) {
      tendance = "baisse";
      phrases.push(`La cote a baissé depuis ${depuis} (${cote(opts.mouvement.premiere)} → ${cote(s.odds)}) : l'avantage fond, mais il reste réel.`);
    }
  }

  const analyse = opts.analyse;
  if (analyse?.verdict === "eviter") {
    return {
      action: "passer",
      heure: new Date(maintenant).toISOString(),
      raisonHeure: "maintenant",
      miseBase: base.mise,
      mise: 0,
      boost: 0,
      tendance,
      verdictIA: "eviter",
      message: `L'analyse de dernière minute m'a fait changer d'avis : ${analyse.resume} On passe ce match.`,
    };
  }

  // Décision sur la mise.
  const miseBase = base.mise;
  let mise = miseBase;
  if (miseBase > 0 && analyse?.verdict === "prudence") {
    mise = arrondir(miseBase / 2, r.arrondi);
    if (mise < r.miseMin) mise = 0;
    phrases.push(mise > 0 ? `Je divise la mise par deux (${eur(mise)} au lieu de ${eur(miseBase)}) : ${analyse.resume}` : `Je préfère m'abstenir : ${analyse.resume}`);
  } else if (
    miseBase > 0 &&
    c.conviction &&
    c.boostMax > 1 &&
    !ctx.protections.prudence &&
    s.confidence >= 85 &&
    s.edge >= 0.04 &&
    s.sharp &&
    s.books >= 3 &&
    !s.suspect
  ) {
    const force = clamp(((s.confidence - 85) / 10 + (s.edge - 0.04) / 0.04) / 2, 0.3, 1);
    const plafond = ctx.total * MISE_MAX_PCT[r.profil];
    const voulue = miseBase * (1 + (c.boostMax - 1) * force);
    mise = Math.max(miseBase, arrondir(Math.min(voulue, plafond, Math.max(0, ctx.poches.classique)), r.arrondi));
    if (mise > miseBase) {
      phrases.push(
        `J'ai pris la décision de monter la mise à ${eur(mise)} au lieu des ${eur(miseBase)} prévus par la gestion de bankroll : indice de confiance ${Math.round(s.confidence)} et une cote de ${cote(s.odds)} très généreuse (le juste prix est ${cote(s.fairOdds)}).`,
      );
    }
  }
  if (mise > 0 && mise === miseBase && analyse?.verdict !== "prudence") {
    phrases.push(`Cote de ${cote(s.odds)} pour un juste prix de ${cote(s.fairOdds)} (${pctSigne(s.edge)}) : je mise ${eur(mise)}, soit ${pct(ctx.total > 0 ? mise / ctx.total : 0, 2)} de ta bankroll.`);
  }

  // Décision sur le moment.
  const foot = s.sportKey.startsWith("soccer");
  const genereuse = s.edge >= 0.05 && s.confidence >= 80;
  let heure = maintenant;
  let raison: RaisonHeure = "maintenant";
  if (h <= 1.25) {
    raison = "imminent";
  } else if (genereuse) {
    raison = "cote_genereuse";
  } else if (h > 30) {
    raison = "jour_du_match";
    heure = aHeure(debut, tz, 10, 0);
    if (heure > debut - 2 * HEURE) heure = aHeure(debut - 24 * HEURE, tz, 19, 0);
    heure = Math.max(heure, maintenant);
  } else if (foot && c.attendreCompos && analyse?.attendreCompositions !== false) {
    const t = heureCompos(debut);
    if (t > maintenant && parties(t, tz).heure >= 8) {
      raison = "compositions";
      heure = t;
    }
  }
  const textes: Record<RaisonHeure, string> = {
    imminent: "Le match commence bientôt : c'est maintenant.",
    cote_genereuse: "Cote nettement au-dessus du marché : je la prends tout de suite, avant que Winamax ne la corrige.",
    compositions: `Attendons les compositions officielles (vers ${hhmm(debut - 60 * MIN, tz)}). Rendez-vous à ${hhmm(heure, tz)} : si rien ne bouge, on joue.`,
    jour_du_match: `Trop tôt pour s'engager, les cotes vont encore bouger. Je réévalue ${jourRelatif(heure, maintenant, tz)} à ${hhmm(heure, tz)}.`,
    maintenant: "On peut jouer dès maintenant.",
  };
  if (mise > 0) phrases.push(textes[raison]);

  return {
    action: mise <= 0 ? "passer" : heure <= maintenant + 5 * MIN ? "jouer" : "attendre",
    heure: new Date(heure).toISOString(),
    raisonHeure: raison,
    miseBase,
    mise,
    boost: miseBase > 0 ? mise / miseBase : 0,
    message: phrases.join(" "),
    tendance,
    verdictIA: analyse?.verdict,
  };
}

// ---------------------------------------------------------------------------
// Plan du jour

export interface ItemPlan {
  id: string;
  type: "simple" | "combine";
  mode: "classique" | "objectif";
  selections: Selection[];
  cote: number;
  mise: number;
  miseBase: number;
  boost: number;
  confiance: number;
  edge: number;
  proba: number;
  heure: string;
  message: string;
  avis?: Avis;
  combo?: PropositionCombo;
}

export interface Session {
  id: string;
  heure: string;
  libelle: string;
  ouverte: boolean; // l'heure est arrivée
  raison: string;
  items: ItemPlan[];
  total: number;
  gainAttendu: number;
}

export interface Plan {
  verdict: "jouer" | "attendre" | "repos";
  titre: string;
  message: string;
  sessions: Session[];
  plusTard: ItemPlan[];
  total: number;
  gainAttendu: number;
  ecartes: { selection: Selection; raison: string }[];
}

export interface OptionsPlan {
  mouvements?: Record<string, MouvementCote>;
  analyses?: Record<string, AnalyseIA>;
}

const LIBELLE_RAISON: Record<RaisonHeure, string> = {
  imminent: "Match imminent",
  cote_genereuse: "Cote généreuse, à prendre vite",
  compositions: "Après les compositions",
  jour_du_match: "Le jour du match",
  maintenant: "Dès maintenant",
};

export function planDuJour(selections: Selection[], ctx: ContexteMise, paris: Pari[], maintenant: number, opts: OptionsPlan = {}): Plan {
  const r = ctx.reglages;
  const tz = r.conseiller.fuseau;
  const prot = ctx.protections;
  const ecartes: Plan["ecartes"] = [];

  if (prot.bloque) {
    return {
      verdict: "repos",
      titre: "On ne joue pas",
      message: `${prot.raisons.join(" ")} Je reprends la main automatiquement dès que c'est possible.`,
      sessions: [],
      plusTard: [],
      total: 0,
      gainAttendu: 0,
      ecartes,
    };
  }

  // 1. Paris simples du mode Classique.
  const recos = planClassique(selections, ctx, paris, maintenant).filter((x) => !x.dejaJoue && x.mise.mise > 0);
  const items: ItemPlan[] = [];
  for (const reco of recos) {
    const s = reco.selection;
    const avis = avisSelection(s, reco.mise, ctx, maintenant, { mouvement: opts.mouvements?.[s.id], analyse: opts.analyses?.[s.id] });
    if (avis.action === "passer") {
      ecartes.push({ selection: s, raison: avis.message });
      continue;
    }
    items.push({
      id: s.id,
      type: "simple",
      mode: "classique",
      selections: [s],
      cote: s.odds,
      mise: avis.mise,
      miseBase: avis.miseBase,
      boost: avis.boost,
      confiance: s.confidence,
      edge: s.edge,
      proba: s.fairProb,
      heure: avis.heure,
      message: avis.message,
      avis,
    });
  }

  // 2. Le combiné du jour (facultatif) : matchs d'aujourd'hui et de demain uniquement.
  if (r.conseiller.combineDuJour) {
    const limite = debutJour(maintenant, tz) + 2 * 86_400_000;
    const enCours = new Set(paris.filter((p) => p.statut === "en_cours").flatMap((p) => p.jambes.map((j) => j.eventId)));
    const pool = poolObjectif(selections, r, maintenant, r.objectifCote.cible).filter((s) => Date.parse(s.commence) < limite && !enCours.has(s.eventId));
    const meilleur = proposerCombos(pool, r.objectifCote.cible, Math.min(r.objectifCote.jambesMax, 5))[0];
    if (meilleur && meilleur.confiance >= 55) {
      const m = miseObjectif(meilleur.confiance, ctx);
      if (m.mise > 0) {
        const premier = Date.parse(meilleur.premierMatch);
        const foot = meilleur.jambes.some((j) => j.sportKey.startsWith("soccer"));
        let heure = maintenant;
        if (foot && r.conseiller.attendreCompos && premier - maintenant > 1.25 * HEURE && premier - maintenant < 30 * HEURE) {
          const t = heureCompos(premier);
          if (parties(t, tz).heure >= 8) heure = t;
        }
        items.push({
          id: `combo:${meilleur.jambes.map((j) => j.id).join("~")}`,
          type: "combine",
          mode: "objectif",
          selections: meilleur.jambes,
          cote: meilleur.cote,
          mise: m.mise,
          miseBase: m.mise,
          boost: 1,
          confiance: meilleur.confiance,
          edge: meilleur.edge,
          proba: meilleur.probaJuste,
          heure: new Date(heure).toISOString(),
          combo: meilleur,
          message: `Le combiné du jour : cote ${cote(meilleur.cote)} en ${meilleur.jambes.length} matchs, ${pct(meilleur.probaJuste)} de chances de passer. Petite mise de ${eur(m.mise)}, prise dans la poche Objectif.`,
        });
      }
    }
  }

  // 3. Respect de l'argent en jeu maximum (le combiné est dans une autre poche mais compte aussi).
  items.sort((a, b) => Date.parse(a.heure) - Date.parse(b.heure) || b.mise * b.edge - a.mise * a.edge);
  let reste = prot.expositionRestante;
  const retenus: ItemPlan[] = [];
  for (const it of items) {
    if (it.mise > reste + 1e-9) {
      ecartes.push({ selection: it.selections[0], raison: "Budget du jour atteint : l'argent déjà en jeu est au maximum autorisé." });
      continue;
    }
    reste -= it.mise;
    retenus.push(it);
  }

  // 4. Aujourd'hui (en sessions horaires) ou plus tard.
  const finJour = debutJour(maintenant, tz) + 86_400_000;
  const jour = cleJour(maintenant, tz);
  const aujourdhui = retenus.filter((i) => Date.parse(i.heure) < finJour);
  const plusTard = retenus.filter((i) => Date.parse(i.heure) >= finJour);
  const sessions: Session[] = [];
  for (const it of aujourdhui) {
    const t = Date.parse(it.heure);
    const immediat = t <= maintenant + 5 * MIN;
    const derniere = sessions[sessions.length - 1];
    if (derniere && (immediat ? derniere.id.endsWith("maintenant") : !derniere.id.endsWith("maintenant") && t - Date.parse(derniere.heure) <= 30 * MIN)) {
      derniere.items.push(it);
      continue;
    }
    sessions.push({
      id: immediat ? `${jour}-maintenant` : `${jour}-${hhmm(t, tz).replace("h", "")}`,
      heure: it.heure,
      libelle: immediat ? "Maintenant" : hhmm(t, tz),
      ouverte: immediat,
      raison: it.avis ? LIBELLE_RAISON[it.avis.raisonHeure] : "Combiné du jour",
      items: [it],
      total: 0,
      gainAttendu: 0,
    });
  }
  for (const s of sessions) {
    s.total = s.items.reduce((t, i) => t + i.mise, 0);
    s.gainAttendu = s.items.reduce((t, i) => t + i.mise * i.edge, 0);
  }

  const total = aujourdhui.reduce((t, i) => t + i.mise, 0);
  const gainAttendu = aujourdhui.reduce((t, i) => t + i.mise * i.edge, 0);
  const n = aujourdhui.length;

  if (n > 0) {
    const morceaux = sessions.map((s) => `${s.items.length} ${s.ouverte ? "tout de suite" : `à ${s.libelle}`}${s.raison === "Après les compositions" ? " (après les compositions)" : ""}`);
    const boostes = aujourdhui.filter((i) => i.boost > 1.001).length;
    return {
      verdict: "jouer",
      titre: n === 1 ? "1 pari aujourd'hui" : `${n} paris aujourd'hui`,
      message:
        `J'ai retenu ${n} pari${n > 1 ? "s" : ""} pour ${eur(total)} au total : ${morceaux.join(", ")}.` +
        (boostes ? ` ${boostes > 1 ? `${boostes} mises sont montées` : "Une mise est montée"} au-dessus du conseil de gestion, car la cote est exceptionnelle.` : "") +
        ` Gain moyen attendu : ${eurSigne(gainAttendu)}.`,
      sessions,
      plusTard,
      total,
      gainAttendu,
      ecartes,
    };
  }

  if (plusTard.length > 0) {
    const prochain = plusTard.reduce((a, b) => (Date.parse(a.heure) <= Date.parse(b.heure) ? a : b));
    const t = Date.parse(prochain.heure);
    return {
      verdict: "attendre",
      titre: "Pas de pari aujourd'hui",
      message: `Aujourd'hui, nous n'avons pas d'indice de confiance assez élevé pour jouer. Voyons ${jourRelatif(t, maintenant, tz)} : j'ai déjà repéré ${plusTard.length} opportunité${plusTard.length > 1 ? "s" : ""}, je te préviens à ${hhmm(t, tz)}.`,
      sessions,
      plusTard,
      total: 0,
      gainAttendu: 0,
      ecartes,
    };
  }

  return {
    verdict: "repos",
    titre: "Pas de pari aujourd'hui",
    message: "Aujourd'hui, nous n'avons pas d'indice de confiance assez élevé pour jouer. On garde la bankroll au chaud : voyons demain. Ne pas parier est aussi une décision gagnante.",
    sessions,
    plusTard,
    total: 0,
    gainAttendu: 0,
    ecartes,
  };
}

// ---------------------------------------------------------------------------
// Récapitulatif depuis la dernière visite

export interface Recap {
  periode: string;
  paris: Pari[];
  gagnes: number;
  perdus: number;
  profit: number;
  meilleur: Pari | null;
  message: string;
}

export function periodeDepuis(depuis: number, maintenant: number, tz: string): string {
  const jours = Math.round((debutJour(maintenant, tz) - debutJour(depuis, tz)) / 86_400_000);
  if (jours <= 0) return "Depuis ta dernière visite";
  if (jours === 1) return parties(depuis, tz).heure >= 17 && parties(maintenant, tz).heure < 14 ? "Cette nuit" : "Depuis hier";
  return `Depuis ${jourRelatif(depuis, maintenant, tz)}`;
}

export function recapDepuis(paris: Pari[], depuis: number, maintenant: number, tz: string): Recap | null {
  const regles = paris.filter((p) => p.statut !== "en_cours" && p.regleLe && Date.parse(p.regleLe) > depuis);
  if (regles.length === 0) return null;
  const profit = regles.reduce((t, p) => t + (p.gain ?? 0) - p.mise, 0);
  const gagnes = regles.filter((p) => p.statut === "gagne").length;
  const perdus = regles.filter((p) => p.statut === "perdu").length;
  const meilleur = regles.filter((p) => p.statut === "gagne").sort((a, b) => (b.gain ?? 0) - b.mise - ((a.gain ?? 0) - a.mise))[0] ?? null;
  const periode = periodeDepuis(depuis, maintenant, tz);
  const n = regles.length;
  let message = `${periode} : ${gagnes} pari${gagnes > 1 ? "s" : ""} gagné${gagnes > 1 ? "s" : ""} sur ${n}, bilan ${eurSigne(profit)}.`;
  if (meilleur) {
    const l = meilleur.jambes.length > 1 ? `le combiné à ${cote(meilleur.cote)}` : `${meilleur.jambes[0]?.label ?? "un pari"} à ${cote(meilleur.cote)}`;
    message += ` Belle prise : ${l} (${eurSigne((meilleur.gain ?? 0) - meilleur.mise)}).`;
  }
  if (profit < 0) message += " Ça fait partie du jeu : la gestion de bankroll est faite pour encaisser ce genre de soirée.";
  return { periode, paris: regles, gagnes, perdus, profit, meilleur, message };
}
