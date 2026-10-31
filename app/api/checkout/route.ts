import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { OFFRES, type Plan } from "@/lib/offres";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const o = OFFRES[body.plan as Plan];
  if (!o) return NextResponse.json({ erreur: "Formule inconnue." }, { status: 400 });
  try {
    const origin = new URL(req.url).origin;
    const s = await getStripe().checkout.sessions.create({
      ui_mode: "embedded",
      mode: o.mode,
      locale: "fr",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: o.montant,
          product_data: { name: `Fantômes — ${o.nom}` },
          ...(o.interval ? { recurring: { interval: o.interval } } : {}),
        },
      }],
      redirect_on_completion: "if_required",
      return_url: `${origin}/releve?session_id={CHECKOUT_SESSION_ID}`,
    });
    return NextResponse.json({ clientSecret: s.client_secret });
  } catch {
    return NextResponse.json({ erreur: "Le paiement est momentanément indisponible." }, { status: 500 });
  }
}
