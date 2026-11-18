// Détection de valeur : on estime la probabilité « juste » de chaque issue à partir du consensus
// des autres bookmakers (marge retirée), puis on la compare à la cote proposée par Winamax.

import type { Bookmaker, BookMarket, FacteursConfiance, MarketKey, Selection, SportEvent } from "../types";
import { clamp, devigPuissance, logit, moyennePonderee, phi } from "./proba";
import { lienMatchWinamax } from "../winamax";

export const BOOKMAKER_CIBLE = "winamax_fr";

/** Poids d'un bookmaker dans le consensus. Les bookmakers « sharp » (marges faibles, limites hautes) pèsent davantage. */
export const POIDS_BOOKMAKERS: Record<string, number> = {
  pinnacle: 3,
  betfair_ex_eu: 2,
  matchbook: 2,
  smarkets: 1.5,
};
export const SHARP = new Set(["pinnacle", "betfair_ex_eu", "matchbook", "smarkets"]);

interface IssueLigne {
  id: string;
  name: string;
  point?: number;
  price: number;
  link?: string;
}

interface Ligne {
  cle: string;
  market: MarketKey;
  issues: IssueLigne[];
  link?: string;
}

/** Découpe un marché en « lignes » complètes (toutes les issues d'une même ligne, ex. Plus/Moins de 2,5). */
export function lignesDuMarche(m: BookMarket, home: string): Ligne[] {
  const valides = m.outcomes.filter((o) => Number.isFinite(o.price) && o.price > 1);
  if (m.key === "h2h") {
    if (valides.length < 2) return [];
    return [{ cle: "h2h", market: "h2h", link: m.link, issues: valides.map((o) => ({ id: o.name, name: o.name, price: o.price, link: o.link })) }];
  }
  if (m.key === "totals") {
    const parPoint = new Map<number, IssueLigne[]>();
    for (const o of valides) {
      if (o.point === undefined) continue;
      const arr = parPoint.get(o.point) ?? [];
      arr.push({ id: o.name, name: o.name, point: o.point, price: o.price, link: o.link });
      parPoint.set(o.point, arr);
    }
    const out: Ligne[] = [];
    for (const [point, issues] of parPoint) {
      const ids = new Set(issues.map((i) => i.id));
      if (issues.length === 2 && ids.has("Over") && ids.has("Under")) out.push({ cle: `totals:${point}`, market: "totals", issues, link: m.link });
    }
    return out;
  }
  if (m.key === "spreads") {
    const homes = valides.filter((o) => o.name === home && o.point !== undefined);
    const out: Ligne[] = [];
    for (const h of homes) {
      const a = valides.find((o) => o.name !== home && o.point === -(h.point as number));
      if (!a) continue;
      out.push({
        cle: `spreads:${h.point}`,
        market: "spreads",
        link: m.link,
        issues: [
          { id: h.name, name: h.name, point: h.point, price: h.price, link: h.link },
          { id: a.name, name: a.name, point: a.point, price: a.price, link: a.link },
        ],
      });
    }
    return out;
  }
  return [];
}

function unite(sportKey: string): string {
  if (sportKey.startsWith("basketball") || sportKey.startsWith("americanfootball") || sportKey.startsWith("rugby")) return "points";
  if (sportKey.startsWith("tennis")) return "jeux";
  if (sportKey.startsWith("baseball")) return "points";
  return "buts";
}

const fmtPoint = (p: number) => p.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export function libelle(market: MarketKey, issue: string, point: number | undefined, sportKey: string): string {
  if (market === "h2h") return issue === "Draw" ? "Match nul" : `Victoire ${issue}`;
  if (market === "totals") return `${issue === "Over" ? "Plus" : "Moins"} de ${fmtPoint(point ?? 0)} ${unite(sportKey)}`;
  const p = point ?? 0;
  return `${issue} (handicap ${p > 0 ? "+" : ""}${fmtPoint(p)})`;
}

/**
 * Incertitude (écart-type en log-cote) de la probabilité juste estimée.
 * Elle augmente quand peu de bookmakers cotent le match, quand ils sont en désaccord,
 * quand le match est lointain (les cotes bougent encore beaucoup) et pour les très grosses cotes.
 */
export function incertitude(args: { books: number; sharp: boolean; ecartLogit: number; p: number; heures: number }): number {
  const { books, sharp, ecartLogit, p, heures } = args;
  let base: number;
  if (books >= 4) base = sharp ? 0.08 : 0.11;
  else if (books >= 2) base = sharp ? 0.1 : 0.14;
  else base = sharp ? 0.12 : 0.2;
  const s = Math.sqrt(base ** 2 + (0.7 * ecartLogit) ** 2);
  const mDelai = heures > 168 ? 1.3 : heures > 48 ? 1 + (0.15 * (heures - 48)) / 120 : heures < 0.5 ? 1.1 : 1;
  const mNiveau = p < 0.03 ? 1.6 : p < 0.1 ? 1.25 : p > 0.9 ? 1.15 : 1;
  return s * mDelai * mNiveau;
}

export function facteurs(args: { books: number; sharp: boolean; ecartLogit: number; p: number; heures: number }): FacteursConfiance {
  const { books, sharp, ecartLogit, p, heures } = args;
  return {
    marche: Math.round(clamp((Math.min(books, 6) / 6) * 80 + (sharp ? 20 : 0), 0, 100)),
    accord: books < 2 ? 40 : Math.round(100 / (1 + (ecartLogit / 0.08) ** 2)),
    delai: Math.round(heures > 168 ? 60 : heures > 48 ? 100 - (25 * (heures - 48)) / 120 : heures < 0.5 ? 80 : 100),
    niveau: Math.round(p < 0.03 ? 35 : p < 0.1 ? 65 : p > 0.9 ? 80 : 100),
  };
}

/** Indice de confiance : probabilité (selon le modèle) que la cote Winamax soit supérieure à la cote juste. */
export function indiceConfiance(fairProb: number, cote: number, sigma: number): number {
  const z = (logit(fairProb) - logit(1 / cote)) / sigma;
  return clamp(100 * phi(z), 1, 99);
}

interface OptionsSelections {
  maintenant?: number;
  cible?: string;
}

/** Construit toutes les sélections pariables chez Winamax avec leur probabilité juste et leur indice de confiance. */
export function construireSelections(events: SportEvent[], opts: OptionsSelections = {}): Selection[] {
  const maintenant = opts.maintenant ?? Date.now();
  const cible = opts.cible ?? BOOKMAKER_CIBLE;
  const out: Selection[] = [];

  for (const ev of events) {
    const debut = Date.parse(ev.commence);
    if (!Number.isFinite(debut) || debut <= maintenant) continue; // pas de live : on ne parie qu'avant le match
    const heures = (debut - maintenant) / 3_600_000;
    const wina = ev.bookmakers.find((b) => b.key === cible);
    if (!wina) continue;
    const autres = ev.bookmakers.filter((b) => b.key !== cible);

    // Index des lignes des autres bookmakers : cle de ligne -> [{book, ligne}]
    const index = new Map<string, { book: Bookmaker; ligne: Ligne }[]>();
    for (const b of autres) {
      for (const m of b.markets) {
        for (const l of lignesDuMarche(m, ev.home)) {
          const arr = index.get(l.cle) ?? [];
          arr.push({ book: b, ligne: l });
          index.set(l.cle, arr);
        }
      }
    }

    for (const m of wina.markets) {
      for (const lw of lignesDuMarche(m, ev.home)) {
        const ids = lw.issues.map((i) => i.id).sort().join("|");
        const refs = (index.get(lw.cle) ?? []).filter((r) => r.ligne.issues.map((i) => i.id).sort().join("|") === ids);
        if (refs.length === 0) continue; // impossible d'estimer un juste prix sans référence externe

        const poids = refs.map((r) => POIDS_BOOKMAKERS[r.book.key] ?? 1);
        const sharp = refs.some((r) => SHARP.has(r.book.key));
        const probasParBook = refs.map((r) => {
          const ordre = lw.issues.map((iw) => r.ligne.issues.find((i) => i.id === iw.id) as IssueLigne);
          return devigPuissance(ordre.map((i) => i.price));
        });

        lw.issues.forEach((iw, k) => {
          const ps = probasParBook.map((v) => v[k]);
          const { moyenne: mLogit, ecart: ecartLogit } = moyennePonderee(
            ps.map((p) => logit(p)),
            poids,
          );
          const fairProb = 1 / (1 + Math.exp(-mLogit));
          const cote = iw.price;
          const sigma = incertitude({ books: refs.length, sharp, ecartLogit, p: fairProb, heures });
          const edge = fairProb * cote - 1;
          let confidence = indiceConfiance(fairProb, cote, sigma);
          const suspect = edge > 0.2;
          if (suspect) confidence = Math.min(confidence, 50);
          out.push({
            id: `${ev.id}|${lw.cle}|${iw.id}`,
            eventId: ev.id,
            sportKey: ev.sportKey,
            sportTitle: ev.sportTitle,
            commence: ev.commence,
            home: ev.home,
            away: ev.away,
            market: lw.market,
            ligne: lw.cle,
            issue: iw.id,
            point: iw.point,
            label: libelle(lw.market, iw.name, iw.point, ev.sportKey),
            odds: cote,
            fairProb,
            fairOdds: 1 / fairProb,
            impliedProb: 1 / cote,
            edge,
            sigma,
            confidence: Math.round(confidence * 10) / 10,
            facteurs: facteurs({ books: refs.length, sharp, ecartLogit, p: fairProb, heures }),
            books: refs.length,
            sharp,
            suspect,
            link: iw.link ?? lw.link ?? wina.link ?? lienMatchWinamax(wina.sid),
          });
        });
      }
    }
  }
  return out;
}

/** Probabilité ajustée prudente : l'avantage estimé est réduit selon l'indice de confiance (rien sous 50). */
export function retrecissement(confiance: number): number {
  return clamp((confiance - 50) / 50, 0, 1);
}

export function probaAjustee(s: Pick<Selection, "fairProb" | "impliedProb" | "edge" | "confidence">): number {
  if (s.edge <= 0) return s.fairProb;
  return s.impliedProb + (s.fairProb - s.impliedProb) * retrecissement(s.confidence);
}
