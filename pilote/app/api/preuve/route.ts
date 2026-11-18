import { NextResponse } from "next/server";
import { cleProfil, stockage } from "@/lib/serveur/stockage";
import { sha256 } from "@/lib/transparence";

export const dynamic = "force-dynamic";

const TAILLE_MAX = 700_000; // image JPEG compressée dans le navigateur (≈ 500 Ko)
const idValide = (id: string) => /^[a-zA-Z0-9-]{8,80}$/.test(id);

/** Dépose la photo d'un ticket ou d'un relevé Winamax. Retourne son adresse et son empreinte. */
export async function POST(req: Request) {
  const c = (await req.json().catch(() => ({}))) as { profilId?: string; id?: string; image?: string };
  if (!cleProfil(c.profilId ?? "") || !idValide(c.id ?? "") || typeof c.image !== "string") return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c.image) || c.image.length > TAILLE_MAX)
    return NextResponse.json({ erreur: "Image invalide ou trop lourde." }, { status: 413 });
  const st = stockage();
  const cle = `preuve:${c.id}`;
  const existante = await st.get<{ profilId: string }>(cle);
  if (existante && existante.profilId !== c.profilId) return NextResponse.json({ erreur: "Cette preuve appartient à un autre profil." }, { status: 403 });
  const empreinte = await sha256(c.image);
  await st.set(cle, { profilId: c.profilId, image: c.image, empreinte, ajouteeLe: new Date().toISOString() });
  return NextResponse.json({ url: `/api/preuve/${c.id}`, empreinte });
}
