import { NextResponse } from "next/server";
import { supprimerActu } from "@/lib/serveur/actus";
import { accesComplet } from "@/lib/serveur/abonnements";
import { estPublic } from "@/lib/serveur/public";
import { cleProfil } from "@/lib/serveur/stockage";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = (await req.json().catch(() => ({}))) as { profilId?: string };
  const p = c.profilId ?? "";
  if (!cleProfil(p) || !(estPublic(p) || accesComplet(p))) return NextResponse.json({ erreur: "Réservé à l'administrateur." }, { status: 403 });
  await supprimerActu(id);
  return NextResponse.json({ ok: true });
}
