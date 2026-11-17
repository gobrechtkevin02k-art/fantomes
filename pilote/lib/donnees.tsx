"use client";

// Récupération des cotes et des résultats, calculs dérivés partagés par toutes les pages.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { OddsResponse, Quota, ScoresResponse, Selection, SportEvent } from "./types";
import { useStore } from "./store";
import { construireSelections } from "./engine/valeur";
import { reglerParis } from "./engine/reglement";
import { calculerBankroll, projection, protections } from "./engine/bankroll";
import type { ContexteMise } from "./engine/mise";

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
    const enAttente = etat.paris.filter((p) => p.statut === "en_cours" && p.jambes.some((j) => j.statut === "en_cours" && Date.parse(j.commence) + 2 * 3_600_000 < now));
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
          notifier(`${regles.length} pari${regles.length > 1 ? "s" : ""} réglé${regles.length > 1 ? "s" : ""} automatiquement (${gagnes} gagné${gagnes > 1 ? "s" : ""}).`, "succes");
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

  const events = useMemo(() => data?.events ?? [], [data]);
  const selections = useMemo(() => construireSelections(events, { maintenant }), [events, maintenant]);

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
    }),
    [data, events, selections, chargement, erreur, maintenant, rafraichir, verifierResultats, toasts, notifier],
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
