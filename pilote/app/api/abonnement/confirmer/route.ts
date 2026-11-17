import { NextResponse } from "next/server";
import { confirmerPaiement, paiementConfigure } from "@/lib/serveur/abonnements";
import { cleProfil } from "@/lib/serveur/stockage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!paiementConfigure()) return NextResponse.json({ erreur: "Paiement non configuré." }, { status: 501 });
  const c = (await req.json().catch(() => ({}))) as { profilId?: string; sessionId?: string };
  if (!cleProfil(c.profilId ?? "") || typeof c.sessionId !== "string" || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(c.sessionId))
    return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  try {
    return NextResponse.json(await confirmerPaiement(c.profilId!, c.sessionId));
  } catch (e) {
    return NextResponse.json({ erreur: (e as Error).message || "Vérification impossible." }, { status: 502 });
  }
}
