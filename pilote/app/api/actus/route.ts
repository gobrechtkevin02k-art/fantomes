import { NextResponse } from "next/server";
import type { Actu, Bilan } from "@/lib/actus";
import { listerActus, publier } from "@/lib/serveur/actus";
import { accesComplet } from "@/lib/serveur/abonnements";
import { estPublic } from "@/lib/serveur/public";
import { cleProfil } from "@/lib/serveur/stockage";
import { uid } from "@/lib/format";

export const dynamic = "force-dynamic";

const admin = (id: string) => cleProfil(id) && (estPublic(id) || accesComplet(id));

/** Fil d'actualités (public). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const actus = await listerActus().catch(() => []);
  return NextResponse.json({ actus: actus.slice(0, Math.min(100, Number(u.searchParams.get("n")) || 50)), admin: admin(u.searchParams.get("id") ?? "") });
}

/** Publication par l'administrateur (annonce ou résultat relu). */
export async function POST(req: Request) {
  const c = (await req.json().catch(() => ({}))) as { profilId?: string; titre?: string; texte?: string; image?: string; bilan?: Bilan; paris?: Actu["paris"]; type?: string };
  if (!admin(c.profilId ?? "")) return NextResponse.json({ erreur: "Réservé à l'administrateur." }, { status: 403 });
  const titre = (c.titre ?? "").trim().slice(0, 140);
  const texte = (c.texte ?? "").trim().slice(0, 2000);
  if (!titre || !texte) return NextResponse.json({ erreur: "Titre et texte obligatoires." }, { status: 400 });
  const image = typeof c.image === "string" && /^\/api\/preuve\/[a-zA-Z0-9-]{8,80}$/.test(c.image) ? c.image : undefined;
  const a: Actu = {
    id: uid(),
    t: new Date().toISOString(),
    type: c.type === "resultat" ? "resultat" : "annonce",
    titre,
    texte,
    ...(image ? { image } : {}),
    ...(c.bilan ? { bilan: c.bilan } : {}),
    ...(Array.isArray(c.paris) ? { paris: c.paris.slice(0, 30) } : {}),
  };
  const notifications = await publier(a, new URL(req.url).origin);
  return NextResponse.json({ actu: a, notifications });
}
