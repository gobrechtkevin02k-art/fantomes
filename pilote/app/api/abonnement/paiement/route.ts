import { NextResponse } from "next/server";
import { creerPaiement, paiementConfigure } from "@/lib/serveur/abonnements";
import { cleProfil } from "@/lib/serveur/stockage";
import { estOffre } from "@/lib/offres";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!paiementConfigure()) return NextResponse.json({ erreur: "Le paiement n'est pas encore configuré." }, { status: 501 });
  const c = (await req.json().catch(() => ({}))) as { profilId?: string; offre?: string };
  if (!cleProfil(c.profilId ?? "") || !estOffre(c.offre) || c.offre === "decouverte") return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  try {
    return NextResponse.json({ url: await creerPaiement(c.profilId!, c.offre, new URL(req.url).origin) });
  } catch {
    return NextResponse.json({ erreur: "Le paiement est momentanément indisponible." }, { status: 502 });
  }
}
