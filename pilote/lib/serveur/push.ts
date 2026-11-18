// Notifications push (Web Push + clés VAPID).

import "server-only";
import { sendNotification, setVapidDetails, type PushSubscription } from "web-push";
import { stockage } from "./stockage";

export const clePubliqueVapid = () => process.env.VAPID_PUBLIC_KEY?.trim() || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "";
export const pushConfigure = () => !!(clePubliqueVapid() && process.env.VAPID_PRIVATE_KEY?.trim());

let initialise = false;
function init() {
  if (initialise) return;
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const sujet = process.env.VAPID_SUBJECT?.trim() || (site ? `https://${site}` : "mailto:pilote@example.com");
  setVapidDetails(sujet, clePubliqueVapid(), process.env.VAPID_PRIVATE_KEY!.trim());
  initialise = true;
}

export interface Notification {
  titre: string;
  texte: string;
  url: string;
  tag?: string;
  actions?: { action: string; title: string }[];
  urlAction?: string;
  badge?: number; // pastille sur l'icône de l'appli installée (nombre de paris à valider)
}

const clePush = (id: string) => `push:${id}`;

export async function abonnements(profilId: string): Promise<PushSubscription[]> {
  return (await stockage().get<PushSubscription[]>(clePush(profilId))) ?? [];
}

export async function abonner(profilId: string, sub: PushSubscription) {
  const subs = (await abonnements(profilId)).filter((s) => s.endpoint !== sub.endpoint);
  await stockage().set(clePush(profilId), [...subs, sub].slice(-5));
}

export async function desabonner(profilId: string, endpoint: string) {
  const subs = (await abonnements(profilId)).filter((s) => s.endpoint !== endpoint);
  await stockage().set(clePush(profilId), subs);
}

/** Envoie une notification sur tous les appareils du profil ; retourne le nombre d'envois réussis. */
export async function envoyer(profilId: string, n: Notification): Promise<number> {
  if (!pushConfigure()) return 0;
  init();
  const subs = await abonnements(profilId);
  let ok = 0;
  const morts: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification(s, JSON.stringify(n), { TTL: 6 * 3600, urgency: "high" });
        ok++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) morts.push(s.endpoint); // abonnement expiré
      }
    }),
  );
  if (morts.length) await stockage().set(clePush(profilId), subs.filter((s) => !morts.includes(s.endpoint)));
  return ok;
}
