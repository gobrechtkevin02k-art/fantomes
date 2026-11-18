// Abonnements : offre de chaque profil, paiement Stripe (Checkout + portail client + webhook).

import "server-only";
import Stripe from "stripe";
import { estOffre, OFFRES, type EtatAbonnement, type Offre } from "../offres";
import { stockage } from "./stockage";

export const paiementConfigure = () => !!process.env.STRIPE_SECRET_KEY?.trim();

let client: Stripe | null = null;
const stripe = () => (client ??= new Stripe(process.env.STRIPE_SECRET_KEY!.trim()));

interface AbonnementStocke {
  offre: Offre;
  statut: EtatAbonnement["statut"];
  finPeriode: string | null;
  customerId: string;
  subscriptionId: string;
}

const cle = (profilId: string) => `abonnement:${profilId}`;

/** Profils qui ont tout débloqué (propriétaire, testeurs) : ils peuvent aussi lancer les tâches d'administration. */
export function accesComplet(profilId: string): boolean {
  return (process.env.PILOTE_ACCES_COMPLET ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .includes(profilId);
}

/** Offre réellement accordée à un profil. */
export async function offreDe(profilId: string): Promise<EtatAbonnement> {
  // Accès complet pour le propriétaire et les testeurs (liste de codes séparés par des virgules).
  const complets = (process.env.PILOTE_ACCES_COMPLET ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  if (complets.includes(profilId)) return { offre: "elite", statut: "actif", finPeriode: null, geste: "complet" };

  const parDefaut = estOffre(process.env.OFFRE_PAR_DEFAUT) ? process.env.OFFRE_PAR_DEFAUT : "decouverte";
  const a = await stockage().get<AbonnementStocke>(cle(profilId)).catch(() => null);
  const valide = a && a.statut === "actif" && (!a.finPeriode || Date.parse(a.finPeriode) + 3 * 86_400_000 > Date.now());
  if (valide) return { offre: a.offre, statut: "actif", finPeriode: a.finPeriode };
  return { offre: parDefaut, statut: a?.statut ?? "aucun", finPeriode: a?.finPeriode ?? null, ...(parDefaut !== "decouverte" ? { geste: "defaut" as const } : {}) };
}

function statutStripe(s: Stripe.Subscription.Status): EtatAbonnement["statut"] {
  if (s === "active" || s === "trialing") return "actif";
  if (s === "past_due" || s === "unpaid" || s === "incomplete") return "impaye";
  return "annule";
}

async function enregistrerDepuisSubscription(sub: Stripe.Subscription) {
  const profilId = sub.metadata?.profilId;
  const offre = sub.metadata?.offre;
  if (!profilId || !estOffre(offre)) return;
  const fin = sub.items.data[0]?.current_period_end;
  const a: AbonnementStocke = {
    offre,
    statut: statutStripe(sub.status),
    finPeriode: fin ? new Date(fin * 1000).toISOString() : null,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    subscriptionId: sub.id,
  };
  await stockage().set(cle(profilId), a);
}

export async function creerPaiement(profilId: string, offre: Offre, origine: string): Promise<string> {
  const o = OFFRES[offre];
  if (o.prix <= 0) throw new Error("Offre gratuite.");
  const existant = await stockage().get<AbonnementStocke>(cle(profilId)).catch(() => null);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    locale: "fr",
    client_reference_id: profilId,
    ...(existant?.customerId ? { customer: existant.customerId } : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: o.prix,
          recurring: { interval: "month" },
          product_data: { name: `Pilote — ${o.nom}` },
        },
      },
    ],
    subscription_data: { metadata: { profilId, offre } },
    allow_promotion_codes: true,
    success_url: `${origine}/offres?retour=ok&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origine}/offres?retour=annule`,
  });
  if (!session.url) throw new Error("Paiement indisponible.");
  return session.url;
}

/** Au retour du paiement, on vérifie directement auprès de Stripe (sans attendre le webhook). */
export async function confirmerPaiement(profilId: string, sessionId: string): Promise<EtatAbonnement> {
  const s = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (s.client_reference_id !== profilId) throw new Error("Ce paiement ne correspond pas à ce profil.");
  if (s.status === "complete" && s.subscription && typeof s.subscription !== "string") await enregistrerDepuisSubscription(s.subscription);
  return offreDe(profilId);
}

export async function lienPortail(profilId: string, origine: string): Promise<string> {
  const a = await stockage().get<AbonnementStocke>(cle(profilId)).catch(() => null);
  if (!a?.customerId) throw new Error("Aucun abonnement payant pour ce profil.");
  const p = await stripe().billingPortal.sessions.create({ customer: a.customerId, return_url: `${origine}/offres`, locale: "fr" });
  return p.url;
}

export async function traiterWebhook(corps: string, signature: string): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET manquant.");
  const e = stripe().webhooks.constructEvent(corps, signature, secret);
  if (e.type === "customer.subscription.created" || e.type === "customer.subscription.updated" || e.type === "customer.subscription.deleted") {
    await enregistrerDepuisSubscription(e.data.object);
  }
}

// ---------------------------------------------------------------------------
// Quotas journaliers (analyses IA)

export async function consommerQuota(profilId: string, nom: string, max: number): Promise<boolean> {
  if (!Number.isFinite(max)) return true;
  if (max <= 0) return false;
  const jour = new Date().toISOString().slice(0, 10);
  const k = `quota:${nom}:${profilId}:${jour}`;
  const n = (await stockage().get<number>(k).catch(() => 0)) ?? 0;
  if (n >= max) return false;
  await stockage().set(k, n + 1, 2 * 86_400);
  return true;
}
