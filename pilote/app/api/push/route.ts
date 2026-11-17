import { NextResponse } from "next/server";
import type { PushSubscription } from "web-push";
import { abonner, clePubliqueVapid, desabonner, pushConfigure } from "@/lib/serveur/push";
import { cleProfil, stockage } from "@/lib/serveur/stockage";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ configure: pushConfigure(), cle: clePubliqueVapid() });
}

export async function POST(req: Request) {
  if (!pushConfigure()) return NextResponse.json({ erreur: "Notifications non configurées sur le serveur (clés VAPID)." }, { status: 501 });
  const c = (await req.json().catch(() => ({}))) as { profilId?: string; subscription?: PushSubscription };
  const s = c.subscription;
  if (!cleProfil(c.profilId ?? "") || !s || typeof s.endpoint !== "string" || !s.endpoint.startsWith("https://") || !s.keys?.p256dh || !s.keys?.auth)
    return NextResponse.json({ erreur: "Abonnement invalide." }, { status: 400 });
  await abonner(c.profilId!, { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
  await stockage().ajouterAEnsemble("profils", c.profilId!);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const c = (await req.json().catch(() => ({}))) as { profilId?: string; endpoint?: string };
  if (!cleProfil(c.profilId ?? "") || typeof c.endpoint !== "string") return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  await desabonner(c.profilId!, c.endpoint);
  return NextResponse.json({ ok: true });
}
