"use client";

// Autonomie côté téléphone : service worker, notifications, synchronisation avec le serveur
// (pour que l'agent puisse prévenir même appli fermée) et validation des paris en un clic.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Pari } from "./types";
import type { ItemPlan, Session } from "./engine/conseiller";
import { cleJour } from "./engine/temps";
import { resumerPlan } from "./serveur/agent";
import { useStore } from "./store";
import { useDonnees, usePlan } from "./donnees";
import { eur, uid } from "./format";

export type EtatNotifications = "chargement" | "non_supporte" | "ios_installer" | "serveur_absent" | "refuse" | "inactif" | "actif";

interface ContexteAutonomie {
  notifications: EtatNotifications;
  activerNotifications: () => Promise<void>;
  desactiverNotifications: () => Promise<void>;
  testerNotification: () => Promise<void>;
  validerItems: (items: ItemPlan[]) => Pari[];
  ticket: Pari[] | null;
  fermerTicket: () => void;
}

const Ctx = createContext<ContexteAutonomie | null>(null);

function base64VersOctets(b64: string): Uint8Array<ArrayBuffer> {
  const p = "=".repeat((4 - (b64.length % 4)) % 4);
  const brut = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
  return out;
}

const estIOS = () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
const estInstallee = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);


export function AutonomieProvider({ children }: { children: ReactNode }) {
  const { pret, etat, ajouterParis, marquerVisite } = useStore();
  const { statut, source, notifier } = useDonnees();
  const plan = usePlan();
  const [notifications, setNotifications] = useState<EtatNotifications>("chargement");
  const [ticket, setTicket] = useState<Pari[] | null>(null);
  const profilId = etat.profilId;
  const synchro = statut ? statut.stockage !== "memoire" : false;

  // Service worker + état des notifications.
  const evaluer = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
      setNotifications(estIOS() && !estInstallee() ? "ios_installer" : "non_supporte");
      return;
    }
    if (!statut) return;
    if (!statut.push) return setNotifications("serveur_absent");
    if (Notification.permission === "denied") return setNotifications("refuse");
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    setNotifications(sub && Notification.permission === "granted" ? "actif" : "inactif");
  }, [statut]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    evaluer();
  }, [evaluer]);

  const envoyer = useCallback(
    (corps: object) =>
      fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId, ...corps }), keepalive: true }).catch(() => {}),
    [profilId],
  );

  // Ouverture de l'appli (l'agent ne réveille pas quelqu'un qui a déjà vu son récap) et fin de visite.
  useEffect(() => {
    if (!pret || !etat.onboarding || !synchro) return;
    envoyer({ ouverture: true });
  }, [pret, etat.onboarding, synchro, envoyer]);
  useEffect(() => {
    const f = () => {
      if (document.visibilityState === "hidden") marquerVisite();
      else if (synchro) envoyer({ ouverture: true });
    };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [marquerVisite, synchro, envoyer]);

  // Copie de l'état sur le serveur (quelques secondes après chaque modification).
  const dernierEnvoi = useRef("");
  useEffect(() => {
    if (!pret || !etat.onboarding || !synchro || dernierEnvoi.current === etat.majLe) return;
    const t = setTimeout(() => {
      dernierEnvoi.current = etat.majLe;
      envoyer({ etat });
    }, 2500);
    return () => clearTimeout(t);
  }, [pret, etat, synchro, envoyer]);

  // Le plan du jour est transmis à l'agent, qui notifiera à chaque heure de jeu.
  const tz = etat.reglages.conseiller.fuseau;
  const signature = plan.sessions.map((s) => `${s.id}:${s.items.length}:${s.total.toFixed(2)}`).join("|") + plan.verdict;
  const derniereSignature = useRef("");
  useEffect(() => {
    if (!pret || !etat.onboarding || !synchro || source === null || signature === derniereSignature.current) return;
    const t = setTimeout(() => {
      derniereSignature.current = signature;
      const now = Date.now();
      envoyer({ plan: resumerPlan(plan, cleJour(now, tz), "client", now) });
    }, 4000);
    return () => clearTimeout(t);
  }, [pret, etat.onboarding, synchro, source, signature, plan, tz, envoyer]);

  // Quand l'appli est ouverte : rappel local à l'heure de chaque session à venir.
  useEffect(() => {
    const timers = plan.sessions
      .filter((s) => !s.ouverte)
      .map((s: Session) => {
        const delai = Date.parse(s.heure) - Date.now();
        if (delai <= 0 || delai > 12 * 3_600_000) return null;
        return setTimeout(async () => {
          notifier(`⏰ ${s.libelle} : ${s.items.length} pari${s.items.length > 1 ? "s" : ""} à valider (${eur(s.total)}).`, "alerte");
          try {
            if (Notification.permission === "granted") {
              const reg = await navigator.serviceWorker.ready;
              await reg.showNotification(`⏰ ${s.libelle} : c'est l'heure de jouer`, {
                body: `${s.items.length} pari${s.items.length > 1 ? "s" : ""} prêt${s.items.length > 1 ? "s" : ""} pour ${eur(s.total)}.`,
                icon: "/icones/icone-192.png",
                badge: "/icones/badge-96.png",
                tag: s.id,
                data: { url: `/?session=${encodeURIComponent(s.id)}`, urlAction: `/?session=${encodeURIComponent(s.id)}&valider=1` },
              });
            }
          } catch {
            /* notifications locales indisponibles */
          }
        }, delai);
      });
    return () => timers.forEach((t) => t && clearTimeout(t));
  }, [plan.sessions, notifier]);

  const activerNotifications = useCallback(async () => {
    if (!statut?.push) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNotifications(permission === "denied" ? "refuse" : "inactif");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { cle } = (await (await fetch("/api/push")).json()) as { cle: string };
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64VersOctets(cle) }));
      // L'agent a besoin de l'état pour préparer le plan du matin.
      await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId, etat }) });
      const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId, subscription: sub.toJSON() }) });
      if (!res.ok) throw new Error();
      setNotifications("actif");
      notifier("Notifications activées : je te préviens le matin et à chaque heure de jeu.", "succes");
    } catch {
      notifier("Impossible d'activer les notifications sur cet appareil.", "alerte");
      evaluer();
    }
  }, [statut, profilId, etat, notifier, evaluer]);

  const desactiverNotifications = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId, endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setNotifications("inactif");
  }, [profilId]);

  const testerNotification = useCallback(async () => {
    const res = await fetch("/api/push/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId }) }).catch(() => null);
    const d = res ? ((await res.json()) as { envoyes?: number }) : {};
    notifier(d.envoyes ? "Notification de test envoyée." : "Aucun appareil n'a reçu la notification.", d.envoyes ? "succes" : "alerte");
  }, [profilId, notifier]);

  /** Enregistre tous les paris d'un coup. L'ouverture de Winamax se fait dans le même clic (voir BoutonValider). */
  const validerItems = useCallback(
    (items: ItemPlan[]): Pari[] => {
      const maintenant = new Date().toISOString();
      const paris: Pari[] = items.map((it) => ({
        id: uid(),
        creeLe: maintenant,
        mode: it.mode,
        jambes: it.selections.map((s) => ({
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
          statut: "en_cours" as const,
        })),
        cote: Math.round(it.cote * 100) / 100,
        mise: it.mise,
        miseConseillee: it.miseBase,
        boost: it.boost,
        confiance: it.confiance,
        edge: it.edge,
        probaEstimee: it.proba,
        statut: "en_cours" as const,
        ...(source === "demo" ? { demo: true } : {}),
      }));
      ajouterParis(paris);
      setTicket(paris);
      return paris;
    },
    [ajouterParis, source],
  );

  const valeur = useMemo(
    () => ({ notifications, activerNotifications, desactiverNotifications, testerNotification, validerItems, ticket, fermerTicket: () => setTicket(null) }),
    [notifications, activerNotifications, desactiverNotifications, testerNotification, validerItems, ticket],
  );
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useAutonomie(): ContexteAutonomie {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAutonomie doit être utilisé dans <AutonomieProvider>");
  return c;
}
