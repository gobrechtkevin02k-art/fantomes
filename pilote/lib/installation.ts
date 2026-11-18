"use client";

// Installation de Pilote comme une appli : détection de l'appareil et du navigateur,
// bouton d'installation natif d'Android/Chrome (beforeinstallprompt) et marche à suivre sur iPhone.

import { useCallback, useSyncExternalStore } from "react";

export type EtatInstallation =
  | "chargement"
  | "installee" // ouverte depuis l'icône de l'écran d'accueil
  | "android" // Chrome/Edge/Samsung proposent l'installation en un bouton
  | "android_manuel" // Android sans invite : passer par le menu du navigateur
  | "ios_safari"
  | "ios_autre" // Chrome, Firefox, Edge sur iPhone (iOS 16.4+ : aussi via Partager)
  | "integre" // navigateur intégré d'Instagram, Facebook, TikTok… : il faut ouvrir le lien dans un vrai navigateur
  | "ordinateur";

interface InvitationInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let invitation: InvitationInstallation | null = null;
let installeeMaintenant = false;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

if (typeof window !== "undefined") {
  // L'invitation a pu arriver avant le chargement de ce code : elle est alors gardée par le script de app/layout.tsx.
  invitation = (window as Window & { __piloteInvitation?: InvitationInstallation }).__piloteInvitation ?? null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // on garde l'invitation pour notre propre bouton
    invitation = e as InvitationInstallation;
    prevenir();
  });
  window.addEventListener("appinstalled", () => {
    invitation = null;
    installeeMaintenant = true;
    prevenir();
  });
}

export function estAppliInstallee(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

export function detecter(ua: string, tactile: number, avecInvitation: boolean, installee: boolean): EtatInstallation {
  if (installee) return "installee";
  if (/FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Snapchat|LinkedInApp|Line\/|; wv\)/i.test(ua)) return "integre";
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && tactile > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) ? "ios_autre" : "ios_safari";
  if (avecInvitation) return /Android/i.test(ua) ? "android" : "ordinateur";
  if (/Android/i.test(ua)) return "android_manuel";
  return "ordinateur";
}

function instantane(): string {
  if (typeof window === "undefined") return "chargement";
  return detecter(navigator.userAgent, navigator.maxTouchPoints ?? 0, !!invitation, installeeMaintenant || estAppliInstallee()) + (invitation ? "+invitation" : "");
}

function abonner(f: () => void) {
  abonnes.add(f);
  const mq = window.matchMedia?.("(display-mode: standalone)");
  mq?.addEventListener?.("change", f);
  return () => {
    abonnes.delete(f);
    mq?.removeEventListener?.("change", f);
  };
}

export function useInstallation(): { etat: EtatInstallation; invitation: boolean; installer: () => Promise<boolean> } {
  const brut = useSyncExternalStore(abonner, instantane, () => "chargement");
  const [etat, suffixe] = brut.split("+") as [EtatInstallation, string | undefined];
  const installer = useCallback(async () => {
    if (!invitation) return false;
    const inv = invitation;
    await inv.prompt();
    const { outcome } = await inv.userChoice;
    invitation = null;
    if (outcome === "accepted") installeeMaintenant = true;
    prevenir();
    return outcome === "accepted";
  }, []);
  return { etat, invitation: suffixe === "invitation", installer };
}
