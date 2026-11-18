// Moteur du backtest : rejoue jour après jour exactement ce que Pilote aurait fait.
// Mêmes fonctions que l'appli : juste prix, indice de confiance, mise de Kelly, garde-fous,
// mise relevée par le conseiller, règlement d'après le score, cote de clôture.

import type { Cloture, EtatApp, Pari, ScoreEvent, SportEvent } from "../types";
import type { MatchHistorique, ParametresBacktest, RapportBacktest } from "./types";
import { reglagesParDefaut } from "../reglages";
import { construireSelections } from "../engine/valeur";
import { planClassique } from "../engine/mise";
import { avisSelection } from "../engine/conseiller";
import { calculerBankroll, protections } from "../engine/bankroll";
import { reglerParis } from "../engine/reglement";
import { calculerCloture } from "../engine/cloture";

const DUREE_MATCH = 2 * 3_600_000; // règlement deux heures après le coup d'envoi

const versEvent = (m: MatchHistorique, bookmakers = m.decision.bookmakers): SportEvent => ({
  id: m.id,
  sportKey: m.sportKey,
  sportTitle: m.sportTitle,
  commence: m.commence,
  home: m.home,
  away: m.away,
  bookmakers,
});

export function executerBacktest(tous: MatchHistorique[], p: ParametresBacktest, source: RapportBacktest["source"]): RapportBacktest {
  // Seuls les matchs dont on connaît le score sont rejoués (sinon on fausserait les résultats).
  const matchs = tous.filter((m) => m.resultat && Date.parse(m.decision.t) < Date.parse(m.commence)).sort((a, b) => a.decision.t.localeCompare(b.decision.t));
  const debut = matchs[0]?.decision.t ?? new Date().toISOString();
  const base = reglagesParDefaut();
  const reglages = {
    ...base,
    bankrollInitiale: p.bankroll,
    dateDebut: debut,
    profil: p.profil,
    objectif: null,
    marches: ["h2h", "totals", "spreads"] as EtatApp["reglages"]["marches"],
    classique: { coteMin: p.coteMin, coteMax: p.coteMax, confianceMin: p.confianceMin, edgeMin: p.edgeMin },
    conseiller: { ...base.conseiller, conviction: p.conviction, fuseau: "Europe/Paris" },
  };
  const etat: Pick<EtatApp, "reglages" | "paris" | "mouvements"> = { reglages, paris: [], mouvements: [] };
  const parId = new Map(matchs.map((m) => [m.id, m]));
  const clotures: Record<string, Cloture> = {};
  let opportunites = 0;
  let compteur = 0;

  const regler = (jusqua: number) => {
    const aRegler = etat.paris.filter((x) => x.statut === "en_cours" && x.jambes.every((j) => Date.parse(j.commence) + DUREE_MATCH <= jusqua));
    if (!aRegler.length) return;
    const modifies = new Map<string, Pari>();
    for (const pari of aRegler) {
      const m = parId.get(pari.jambes[0].eventId)!;
      const score: ScoreEvent = {
        id: m.id,
        sportKey: m.sportKey,
        commence: m.commence,
        completed: true,
        home: m.home,
        away: m.away,
        scores: [
          { name: m.home, score: m.resultat!.home },
          { name: m.away, score: m.resultat!.away },
        ],
      };
      const t = Date.parse(m.commence) + DUREE_MATCH;
      for (const r of reglerParis([pari], [score], t)) modifies.set(r.id, r);
    }
    etat.paris = etat.paris.map((x) => modifies.get(x.id) ?? x);
  };

  // Les décisions sont prises par « vagues » : tous les matchs relevés au même instant.
  const vagues = new Map<string, MatchHistorique[]>();
  for (const m of matchs) vagues.set(m.decision.t, [...(vagues.get(m.decision.t) ?? []), m]);

  for (const [t, groupe] of vagues) {
    const maintenant = Date.parse(t);
    regler(maintenant);
    const selections = construireSelections(groupe.map((m) => versEvent(m)), { maintenant });
    opportunites += selections.filter((s) => s.edge > 0 && s.confidence >= 50).length;
    const bk = calculerBankroll(etat);
    const ctx = { reglages, poches: bk.poches, total: bk.total, protections: protections(reglages, etat.paris, bk, maintenant) };
    for (const reco of planClassique(selections, ctx, etat.paris, maintenant)) {
      if (reco.dejaJoue || reco.horsBudget || reco.mise.mise <= 0) continue;
      const s = reco.selection;
      const avis = avisSelection(s, reco.mise, ctx, maintenant);
      if (avis.action === "passer" || avis.mise <= 0) continue;
      compteur++;
      etat.paris.push({
        id: `bt-${compteur}`,
        creeLe: t,
        mode: "classique",
        jambes: [
          {
            selectionId: s.id,
            eventId: s.eventId,
            sportKey: s.sportKey,
            sportTitle: s.sportTitle,
            commence: s.commence,
            home: s.home,
            away: s.away,
            market: s.market,
            issue: s.issue,
            point: s.point,
            label: s.label,
            odds: s.odds,
            fairProb: s.fairProb,
            statut: "en_cours",
          },
        ],
        cote: s.odds,
        mise: avis.mise,
        miseConseillee: avis.miseBase,
        boost: avis.boost,
        confiance: s.confidence,
        edge: s.edge,
        probaEstimee: s.fairProb,
        statut: "en_cours",
      });
      const m = parId.get(s.eventId)!;
      if (m.cloture) {
        const c = calculerCloture(versEvent(m, m.cloture.bookmakers), s.id, Date.parse(m.cloture.t));
        if (c) clotures[s.id] = c;
      }
    }
  }
  regler(Infinity);

  return {
    source,
    genereLe: new Date().toISOString(),
    parametres: p,
    periode: { du: matchs[0]?.commence ?? debut, au: matchs[matchs.length - 1]?.commence ?? debut },
    sports: [...new Set(matchs.map((m) => m.sportKey))],
    matchs: matchs.length,
    matchsSansResultat: tous.length - matchs.length,
    opportunites,
    paris: etat.paris,
    clotures,
    bankrollFinale: calculerBankroll(etat).total,
  };
}
