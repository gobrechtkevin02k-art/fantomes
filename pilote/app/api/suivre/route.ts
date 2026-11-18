import { NextResponse } from "next/server";
import { CLE_SUIVEURS } from "@/lib/serveur/public";
import { cleProfil, stockage } from "@/lib/serveur/stockage";

export const dynamic = "force-dynamic";

/** Suivre le compte public : notifications à chaque nouveau pari et à chaque résultat. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!cleProfil(id)) return NextResponse.json({ suit: false });
  return NextResponse.json({ suit: (await stockage().membres(CLE_SUIVEURS)).includes(id) });
}

export async function POST(req: Request) {
  const c = (await req.json().catch(() => ({}))) as { profilId?: string };
  if (!cleProfil(c.profilId ?? "")) return NextResponse.json({ erreur: "Profil invalide." }, { status: 400 });
  await stockage().ajouterAEnsemble(CLE_SUIVEURS, c.profilId!);
  return NextResponse.json({ suit: true });
}

export async function DELETE(req: Request) {
  const c = (await req.json().catch(() => ({}))) as { profilId?: string };
  if (!cleProfil(c.profilId ?? "")) return NextResponse.json({ erreur: "Profil invalide." }, { status: 400 });
  await stockage().retirerDeEnsemble(CLE_SUIVEURS, c.profilId!);
  return NextResponse.json({ suit: false });
}
