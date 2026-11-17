import { NextResponse } from "next/server";
import { lienPortail, paiementConfigure } from "@/lib/serveur/abonnements";
import { cleProfil } from "@/lib/serveur/stockage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!paiementConfigure()) return NextResponse.json({ erreur: "Paiement non configuré." }, { status: 501 });
  const c = (await req.json().catch(() => ({}))) as { profilId?: string };
  if (!cleProfil(c.profilId ?? "")) return NextResponse.json({ erreur: "Profil invalide." }, { status: 400 });
  try {
    return NextResponse.json({ url: await lienPortail(c.profilId!, new URL(req.url).origin) });
  } catch (e) {
    return NextResponse.json({ erreur: (e as Error).message }, { status: 404 });
  }
}
