"use client";

// État de l'application (bankroll, paris, réglages), conservé dans le navigateur (localStorage).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EtatApp, Mouvement, Pari, Reglages, ReleveSolde } from "./types";
import { uid } from "./format";
import { SPORTS_PAR_DEFAUT } from "./sports";

const CLE = "pilote:etat:v1";

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

export function etatInitial(): EtatApp {
  return { version: 1, profilId: uid(), reglages: reglagesParDefaut(), paris: [], mouvements: [], onboarding: false, derniereVisite: null, majLe: new Date().toISOString() };
}

function fusionner(brut: unknown): EtatApp {
  const base = etatInitial();
  if (!brut || typeof brut !== "object") return base;
  const e = brut as Partial<EtatApp>;
  const r = (e.reglages ?? {}) as Partial<Reglages>;
  return {
    version: 1,
    profilId: typeof e.profilId === "string" && e.profilId ? e.profilId : base.profilId,
    derniereVisite: typeof e.derniereVisite === "string" ? e.derniereVisite : null,
    majLe: typeof e.majLe === "string" ? e.majLe : base.majLe,
    reglages: {
      ...base.reglages,
      ...r,
      allocation: { ...base.reglages.allocation, ...(r.allocation ?? {}) },
      classique: { ...base.reglages.classique, ...(r.classique ?? {}) },
      objectifCote: { ...base.reglages.objectifCote, ...(r.objectifCote ?? {}) },
      jackpot: { ...base.reglages.jackpot, ...(r.jackpot ?? {}) },
      conseiller: { ...base.reglages.conseiller, ...(r.conseiller ?? {}) },
    },
    paris: Array.isArray(e.paris) ? e.paris : [],
    releves: Array.isArray(e.releves) ? e.releves : [],
    mouvements: Array.isArray(e.mouvements) ? e.mouvements : [],
    onboarding: !!e.onboarding,
  };
}

const horodater = (e: EtatApp): EtatApp => ({ ...e, majLe: new Date().toISOString() });

interface ContexteStore {
  pret: boolean;
  etat: EtatApp;
  majReglages: (r: Partial<Reglages>) => void;
  terminerOnboarding: (r: Partial<Reglages>) => void;
  ajouterPari: (p: Pari) => void;
  ajouterParis: (ps: Pari[]) => void;
  ajouterReleve: (r: ReleveSolde) => void;
  marquerVisite: () => void;
  majParis: (ps: Pari[]) => void;
  supprimerPari: (id: string) => void;
  ajouterMouvement: (m: Mouvement) => void;
  supprimerMouvement: (id: string) => void;
  remplacer: (e: unknown) => void;
  reinitialiser: () => void;
}

const Ctx = createContext<ContexteStore | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatApp>(etatInitial);
  const [pret, setPret] = useState(false);
  const charge = useRef(false);

  useEffect(() => {
    try {
      const brut = localStorage.getItem(CLE);
      if (brut) setEtat(fusionner(JSON.parse(brut)));
    } catch {
      /* stockage indisponible : on garde l'état par défaut */
    }
    charge.current = true;
    setPret(true);
  }, []);

  useEffect(() => {
    if (!charge.current) return;
    try {
      localStorage.setItem(CLE, JSON.stringify(etat));
    } catch {
      /* stockage plein ou bloqué */
    }
  }, [etat]);

  // Synchronisation entre onglets ouverts.
  useEffect(() => {
    const f = (e: StorageEvent) => {
      if (e.key === CLE && e.newValue) {
        try {
          setEtat(fusionner(JSON.parse(e.newValue)));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", f);
    return () => window.removeEventListener("storage", f);
  }, []);

  const majReglages = useCallback((r: Partial<Reglages>) => setEtat((e) => horodater({ ...e, reglages: { ...e.reglages, ...r } })), []);
  const terminerOnboarding = useCallback(
    (r: Partial<Reglages>) => setEtat((e) => horodater({ ...e, onboarding: true, derniereVisite: new Date().toISOString(), reglages: { ...e.reglages, ...r, dateDebut: new Date().toISOString() } })),
    [],
  );
  const ajouterPari = useCallback((p: Pari) => setEtat((e) => horodater({ ...e, paris: [p, ...e.paris] })), []);
  const ajouterParis = useCallback((ps: Pari[]) => setEtat((e) => horodater({ ...e, paris: [...ps, ...e.paris] })), []);
  const majParis = useCallback(
    (ps: Pari[]) =>
      setEtat((e) => {
        const m = new Map(ps.map((p) => [p.id, p]));
        return horodater({ ...e, paris: e.paris.map((p) => m.get(p.id) ?? p) });
      }),
    [],
  );
  const supprimerPari = useCallback((id: string) => setEtat((e) => horodater({ ...e, paris: e.paris.filter((p) => p.id !== id) })), []);
  const ajouterMouvement = useCallback((m: Mouvement) => setEtat((e) => horodater({ ...e, mouvements: [...e.mouvements, m] })), []);
  const supprimerMouvement = useCallback((id: string) => setEtat((e) => horodater({ ...e, mouvements: e.mouvements.filter((m) => m.id !== id) })), []);
  const remplacer = useCallback((brut: unknown) => setEtat(fusionner(brut)), []);
  const reinitialiser = useCallback(() => setEtat(etatInitial()), []);
  const ajouterReleve = useCallback((r: ReleveSolde) => setEtat((e) => horodater({ ...e, releves: [...(e.releves ?? []), r] })), []);
  const marquerVisite = useCallback(() => setEtat((e) => ({ ...e, derniereVisite: new Date().toISOString() })), []);

  const valeur = useMemo(
    () => ({ pret, etat, majReglages, terminerOnboarding, ajouterPari, ajouterParis, ajouterReleve, marquerVisite, majParis, supprimerPari, ajouterMouvement, supprimerMouvement, remplacer, reinitialiser }),
    [pret, etat, majReglages, terminerOnboarding, ajouterPari, ajouterParis, ajouterReleve, marquerVisite, majParis, supprimerPari, ajouterMouvement, supprimerMouvement, remplacer, reinitialiser],
  );
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useStore(): ContexteStore {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore doit être utilisé dans <StoreProvider>");
  return c;
}
