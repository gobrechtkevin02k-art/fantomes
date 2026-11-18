import { stockage } from "@/lib/serveur/stockage";

export const dynamic = "force-dynamic";

/** Sert la photo d'une preuve. Les identifiants sont aléatoires : seule la personne qui a le lien peut la voir. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(id)) return new Response("Introuvable", { status: 404 });
  const p = await stockage().get<{ image: string; empreinte: string }>(`preuve:${id}`);
  if (!p) return new Response("Introuvable", { status: 404 });
  const [entete, donnees] = p.image.split(",");
  const type = entete.slice(5, entete.indexOf(";"));
  return new Response(Buffer.from(donnees, "base64"), {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Empreinte-Sha256": p.empreinte },
  });
}
