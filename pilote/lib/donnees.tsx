"use client";

// Récupération des cotes et des résultats, calculs dérivés partagés par toutes les pages.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AnalyseIA, OddsResponse, Quota, ScoresResponse, Selection, SportEvent } from "./types";
import { useStore } from "./store";
import { construireSelections } from "./engine/valeur";
import { reglerParis } from "./engine/reglement";
import { calculerBankroll, projection, protections } from "./engine/bankroll";
import type { ContexteMise } from "./engine/mise";
import { planDuJour, type MouvementCote } from "./engine/conseiller";
import { droitsDe, type Droits, type EtatAbonnement } from "./offres";

const CLE_MOUVEMENTS = "pilote:cotes-vues:v1";
const CLE_ANALYSES = "pilote:analyses:v1";
const CLE_ABONNEMENT = "pilote:abonnement:v1";

export interface Abonnement extends EtatAbonnement {
  paiement: boolean;
}
const TTL_ANALYSE = 3 * 3_600_000;

export interface Statut {
  cotes: "live" | "demo";
  ia: boolean;
  modeleIA: string;
  stockage: "redis" | "fichier" | "memoire";
  push: boolean;
  cron: boolean;
}

export type EtatAnalyse = { etat: "chargement" } | { etat: "ok"; analyse: AnalyseIA } | { etat: "erreur"; erreur: string };

interface MouvementStocke extends MouvementCote {
  commence: string;
}

function lireJson<T>(cle: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}
function ecrireJson(cle: string, v: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(v));
  } catch {
    /* stockage plein ou bloqué */
  }
}

const CLE_CACHE = "pilote:cotes:v1";
const TTL_CLIENT = 30 * 60_000;

interface Toast {
  id: number;
  texte: string;
  ton: "info" | "succes" | "alerte";
}

interface ContexteDonnees {
  source: "live" | "demo" | null;
  events: SportEvent[];
  selections: Selection[];
  chargement: boolean;
  erreur: string | null;
  erreursApi: string[];
  majLe: string | null;
  quota: Quota;
  maintenant: number;
  rafraichir: (force?: boolean) => Promise<void>;
  verifierResultats: () => Promise<number>;
  toasts: Toast[];
  notifier: (texte: string, ton?: Toast["ton"]) => void;
  statut: Statut | null;
  mouvements: Record<string, MouvementCote>;
  analyses: Record<string, EtatAnalyse>;
  demanderAnalyse: (s: Selection) => Promise<void>;
  abonnement: Abonnement;
  droits: Droits;
  rafraichirAbonnement: () => Promise<void>;
}

const Ctx = createContext<ContexteDonnees | null>(null);

interface Cache {
  cle: string;
  data: OddsResponse;
}

export function DonneesProvider({ children }: { children: ReactNode }) {
  const { pret, etat, majParis } = useStore();
  const [data, setData] = useState<OddsResponse | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const resultatsVerifies = useRef(false);
  const [statut, setStatut] = useState<Statut | null>(null);
  const [mouvements, setMouvements] = useState<Record<string, MouvementStocke>>({});
  const [analyses, setAnalyses] = useState<Record<string, EtatAnalyse>>({});
  const [abonnement, setAbonnement] = useState<Abonnement>({ offre: "decouverte", statut: "aucun", finPeriode: null, paiement: false });
  const profilId = etat.profilId;

  const rafraichirAbonnement = useCallback(async () => {
    try {
      const res = await fetch(`/api/abonnement?id=${encodeURIComponent(profilId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const a = (await res.json()) as Abonnement;
      setAbonnement(a);
      ecrireJson(CLE_ABONNEMENT, a);
    } catch {
      /* hors ligne : on garde la dernière offre connue */
    }
  }, [profilId]);

  useEffect(() => {
    if (!pret) return;
    const connu = lireJson<Abonnement | null>(CLE_ABONNEMENT, null);
    if (connu) setAbonnement(connu);
    rafraichirAbonnement();
  }, [pret, rafraichirAbonnement]);

  useEffect(() => {
    fetch("/api/statut", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Statut) => setStatut(d))
      .catch(() => {});
    setMouvements(lireJson<Record<string, MouvementStocke>>(CLE_MOUVEMENTS, {}));
    const cache = lireJson<Record<string, AnalyseIA>>(CLE_ANALYSES, {});
    const frais: Record<string, EtatAnalyse> = {};
    for (const [id, a] of Object.entries(cache)) if (Date.now() - Date.parse(a.genereLe) < TTL_ANALYSE) frais[id] = { etat: "ok", analyse: a };
    setAnalyses(frais);
  }, []);

  const { sports, marches } = etat.reglages;
  const cle = `${[...sports].sort().join(",")}|${[...marches].sort().join(",")}`;

  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const notifier = useCallback((texte: string, ton: Toast["ton"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, texte, ton }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const rafraichir = useCallback(
    async (force = false) => {
      if (!force) {
        try {
          const brut = localStorage.getItem(CLE_CACHE);
          if (brut) {
            const c = JSON.parse(brut) as Cache;
            if (c.cle === cle && Date.now() - Date.parse(c.data.fetchedAt) < TTL_CLIENT) {
              setData(c.data);
              return;
            }
          }
        } catch {
          /* cache illisible */
        }
      }
      setChargement(true);
      setErreur(null);
      try {
        const q = new URLSearchParams({ sports: sports.join(","), markets: marches.join(",") });
        const res = await fetch(`/api/cotes?${q}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const d = (await res.json()) as OddsResponse;
        setData(d);
        setMaintenant(Date.now());
        try {
          localStorage.setItem(CLE_CACHE, JSON.stringify({ cle, data: d } satisfies Cache));
        } catch {
          /* stockage plein */
        }
        if (force) notifier(d.source === "demo" ? "Cotes de démonstration rechargées." : `Cotes Winamax à jour (${d.events.length} matchs).`, "succes");
      } catch (e) {
        setErreur((e as Error).message || "Impossible de récupérer les cotes.");
      } finally {
        setChargement(false);
      }
    },
    [cle, sports, marches, notifier],
  );

  useEffect(() => {
    if (pret) rafraichir(false);
  }, [pret, rafraichir]);

  const verifierResultats = useCallback(async (): Promise<number> => {
    const now = Date.now();
    const enAttente = etat.paris.filter((p) => p.statut === "en_cours" && p.jambes.some((j) => j.statut === "en_cours" && Date.parse(j.commence) + 45 * 60_000 < now));
    if (enAttente.length === 0) return 0;
    const sportsAttente = [...new Set(enAttente.flatMap((p) => p.jambes.map((j) => j.sportKey)))];
    try {
      const res = await fetch(`/api/scores?${new URLSearchParams({ sports: sportsAttente.join(","), days: "3" })}`, { cache: "no-store" });
      if (!res.ok) return 0;
      const d = (await res.json()) as ScoresResponse;
      const modifies = reglerParis(enAttente, d.scores, now);
      if (modifies.length) {
        majParis(modifies);
        const regles = modifies.filter((p) => p.statut !== "en_cours");
        if (regles.length) {
          const gagnes = regles.filter((p) => p.statut === "gagne").length;
          const bilan = regles.reduce((t, p) => t + (p.gain ?? 0) - p.mise, 0);
          notifier(
            `${regles.length} pari${regles.length > 1 ? "s" : ""} réglé${regles.length > 1 ? "s" : ""} (${gagnes} gagné${gagnes > 1 ? "s" : ""}, ${bilan >= 0 ? "+" : "−"}${Math.abs(bilan).toFixed(2).replace(".", ",")} €). Les prochaines mises sont recalculées sur ta nouvelle bankroll.`,
            bilan >= 0 ? "succes" : "info",
          );
        }
      }
      return modifies.length;
    } catch {
      return 0;
    }
  }, [etat.paris, majParis, notifier]);

  useEffect(() => {
    if (pret && !resultatsVerifies.current) {
      resultatsVerifies.current = true;
      verifierResultats();
    }
  }, [pret, verifierResultats]);

  // Temps réel : tant qu'un match sur lequel tu as parié est en cours, les résultats sont vérifiés toutes les 3 minutes.
  const matchEnCours = etat.paris.some((p) => p.statut === "en_cours" && p.jambes.some((j) => j.statut === "en_cours" && Date.parse(j.commence) <= maintenant));
  useEffect(() => {
    if (!pret || !matchEnCours) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") verifierResultats();
    }, 3 * 60_000);
    return () => clearInterval(t);
  }, [pret, matchEnCours, verifierResultats]);

  const events = useMemo(() => data?.events ?? [], [data]);
  const selections = useMemo(() => construireSelections(events, { maintenant }), [events, maintenant]);

  // Mémorise la première cote vue pour chaque sélection, afin de suivre son évolution dans la journée.
  useEffect(() => {
    if (!selections.length) return;
    setMouvements((prev) => {
      const now = Date.now();
      const suivant: Record<string, MouvementStocke> = {};
      for (const [id, m] of Object.entries(prev)) if (Date.parse(m.commence) > now - 86_400_000) suivant[id] = m;
      let change = Object.keys(suivant).length !== Object.keys(prev).length;
      for (const s of selections) {
        if (!suivant[s.id]) {
          suivant[s.id] = { premiere: s.odds, tPremiere: new Date(now).toISOString(), commence: s.commence };
          change = true;
        }
      }
      if (!change) return prev;
      ecrireJson(CLE_MOUVEMENTS, suivant);
      return suivant;
    });
  }, [selections]);

  const demanderAnalyse = useCallback(
    async (s: Selection) => {
      setAnalyses((a) => ({ ...a, [s.id]: { etat: "chargement" } }));
      const m = mouvements[s.id];
      const variation = m && Math.abs(s.odds - m.premiere) >= 0.01 ? `cote passée de ${m.premiere.toFixed(2)} à ${s.odds.toFixed(2)} depuis ${new Date(m.tPremiere).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : undefined;
      try {
        const res = await fetch("/api/analyse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profilId: etat.profilId,
            id: s.id,
            sport: s.sportKey.split("_")[0],
            competition: s.sportTitle,
            debut: s.commence,
            domicile: s.home,
            exterieur: s.away,
            selection: s.label,
            coteWinamax: s.odds,
            coteJuste: s.fairOdds,
            avantage: s.edge,
            confiance: s.confidence,
            bookmakers: s.books,
            ...(variation ? { mouvement: variation } : {}),
          }),
        });
        const d = (await res.json()) as { analyse?: AnalyseIA; erreur?: string };
        if (!res.ok || !d.analyse) throw new Error(d.erreur ?? `Erreur ${res.status}`);
        const analyse = d.analyse;
        setAnalyses((a) => ({ ...a, [s.id]: { etat: "ok", analyse } }));
        const cache = lireJson<Record<string, AnalyseIA>>(CLE_ANALYSES, {});
        for (const [id, x] of Object.entries(cache)) if (Date.now() - Date.parse(x.genereLe) > TTL_ANALYSE) delete cache[id];
        ecrireJson(CLE_ANALYSES, { ...cache, [s.id]: analyse });
      } catch (e) {
        setAnalyses((a) => ({ ...a, [s.id]: { etat: "erreur", erreur: (e as Error).message || "Analyse impossible." } }));
      }
    },
    [mouvements, etat.profilId],
  );

  const valeur = useMemo<ContexteDonnees>(
    () => ({
      source: data?.source ?? null,
      events,
      selections,
      chargement,
      erreur,
      erreursApi: data?.errors ?? [],
      majLe: data?.fetchedAt ?? null,
      quota: data?.quota ?? { remaining: null, used: null },
      maintenant,
      rafraichir,
      verifierResultats,
      toasts,
      notifier,
      statut,
      mouvements,
      analyses,
      demanderAnalyse,
      abonnement,
      droits: droitsDe(abonnement.offre),
      rafraichirAbonnement,
    }),
    [data, events, selections, chargement, erreur, maintenant, rafraichir, verifierResultats, toasts, notifier, statut, mouvements, analyses, demanderAnalyse, abonnement, rafraichirAbonnement],
  );
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useDonnees(): ContexteDonnees {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDonnees doit être utilisé dans <DonneesProvider>");
  return c;
}

/** Bankroll, garde-fous, contexte de mise et projection, recalculés à chaque changement. */
export function useCalculs() {
  const { etat } = useStore();
  const { maintenant } = useDonnees();
  return useMemo(() => {
    const bk = calculerBankroll(etat);
    const prot = protections(etat.reglages, etat.paris, bk, maintenant);
    const ctx: ContexteMise = { reglages: etat.reglages, poches: bk.poches, total: bk.total, protections: prot };
    const proj = projection(etat.reglages, etat.paris, bk, maintenant);
    return { bk, prot, ctx, proj };
  }, [etat, maintenant]);
}

/** Le plan du jour du conseiller, recalculé à chaque changement de cotes, d'analyses ou de bankroll. */
export function usePlan() {
  const { etat } = useStore();
  const { selections, maintenant, mouvements, analyses, droits } = useDonnees();
  const { ctx } = useCalculs();
  return useMemo(() => {
    const ok: Record<string, AnalyseIA> = {};
    for (const [id, a] of Object.entries(analyses)) if (a.etat === "ok") ok[id] = a.analyse;
    return planDuJour(selections, ctx, etat.paris, maintenant, { mouvements, analyses: ok, limiteParJour: droits.parisParJour, conviction: droits.conviction });
  }, [selections, ctx, etat.paris, maintenant, mouvements, analyses, droits]);
}
