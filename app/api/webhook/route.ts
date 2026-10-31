import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ erreur: "Non autorisé." }, { status: 400 });
  let event;
  try { event = getStripe().webhooks.constructEvent(await req.text(), sig, secret); }
  catch { return NextResponse.json({ erreur: "Signature invalide." }, { status: 400 }); }

  if (event.type === "checkout.session.completed") {
    // Paiement confirmé par Stripe, signature vérifiée. Trace dans les journaux Vercel.
    // Plus tard : enregistrer la vente / envoyer l'email de livraison ici.
    console.log("VENTE confirmée", event.data.object.id);
  }
  return NextResponse.json({ recu: true });
}
