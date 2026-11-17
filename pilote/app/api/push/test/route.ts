import { NextResponse } from "next/server";
import { envoyer, pushConfigure } from "@/lib/serveur/push";
import { cleProfil } from "@/lib/serveur/stockage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!pushConfigure()) return NextResponse.json({ erreur: "Notifications non configurées." }, { status: 501 });
  const c = (await req.json().catch(() => ({}))) as { profilId?: string };
  if (!cleProfil(c.profilId ?? "")) return NextResponse.json({ erreur: "Profil invalide." }, { status: 400 });
  const n = await envoyer(c.profilId!, { titre: "👋 Pilote est prêt", texte: "Les notifications fonctionnent : je te préviendrai le matin et à chaque heure de jeu.", url: "/", tag: "test" });
  return NextResponse.json({ envoyes: n });
}
