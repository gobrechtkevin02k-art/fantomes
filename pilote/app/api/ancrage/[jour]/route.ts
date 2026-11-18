import { CLE_ANCRAGES, texteAncre } from "@/lib/serveur/ancrage";
import { stockage } from "@/lib/serveur/stockage";
import type { Ancrage } from "@/lib/transparence";

export const dynamic = "force-dynamic";

/** Fichiers à vérifier avec OpenTimestamps : l'empreinte (.txt) et sa preuve (.ots). */
export async function GET(req: Request, { params }: { params: Promise<{ jour: string }> }) {
  const { jour } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return new Response("Introuvable", { status: 404 });
  const a = ((await stockage().get<Ancrage[]>(CLE_ANCRAGES)) ?? []).find((x) => x.jour === jour);
  if (!a) return new Response("Introuvable", { status: 404 });
  const format = new URL(req.url).searchParams.get("format");
  if (format === "ots") {
    const b64 = await stockage().get<string>(`ancrage-ots:${jour}`);
    if (!b64) return new Response("Preuve indisponible", { status: 404 });
    return new Response(Buffer.from(b64, "base64"), {
      headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="pilote-empreinte-${jour}.txt.ots"` },
    });
  }
  return new Response(texteAncre(a), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="pilote-empreinte-${jour}.txt"` },
  });
}
