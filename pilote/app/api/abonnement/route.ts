import { NextResponse } from "next/server";
import { offreDe, paiementConfigure } from "@/lib/serveur/abonnements";
import { cleProfil } from "@/lib/serveur/stockage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!cleProfil(id)) return NextResponse.json({ erreur: "Profil invalide." }, { status: 400 });
  return NextResponse.json({ ...(await offreDe(id)), paiement: paiementConfigure() });
}
