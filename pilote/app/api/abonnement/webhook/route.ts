import { NextResponse } from "next/server";
import { paiementConfigure, traiterWebhook } from "@/lib/serveur/abonnements";

export const dynamic = "force-dynamic";

// Événements Stripe à cocher : customer.subscription.created, .updated, .deleted
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!paiementConfigure() || !sig) return NextResponse.json({ erreur: "Non autorisé." }, { status: 400 });
  try {
    await traiterWebhook(await req.text(), sig);
    return NextResponse.json({ recu: true });
  } catch {
    return NextResponse.json({ erreur: "Signature invalide." }, { status: 400 });
  }
}
