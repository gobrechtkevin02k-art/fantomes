import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { controler, messageParDefaut, titreBilan, type Actu, type LectureCapture } from "@/lib/actus";
import { iaConfiguree } from "@/lib/serveur/analyste";
import { lireCapture } from "@/lib/serveur/lecteur";
import { publier } from "@/lib/serveur/actus";
import { accesComplet } from "@/lib/serveur/abonnements";
import { estPublic, profilPublic } from "@/lib/serveur/public";
import { cleProfil, stockage } from "@/lib/serveur/stockage";
import { sha256 } from "@/lib/transparence";
import { uid } from "@/lib/format";
import type { EtatApp } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Module admin : une capture Winamax est lue par l'IA, contrôlée (cohérence des chiffres, rapprochement avec
 * le journal public), puis publiée automatiquement si la lecture est sûre ; sinon un brouillon est renvoyé pour relecture.
 */
export async function POST(req: Request) {
  const c = (await req.json().catch(() => ({}))) as { profilId?: string; image?: string; contexte?: string; auto?: boolean };
  const id = c.profilId ?? "";
  if (!cleProfil(id) || !(estPublic(id) || accesComplet(id))) return NextResponse.json({ erreur: "Réservé à l'administrateur." }, { status: 403 });
  if (typeof c.image !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c.image) || c.image.length > 700_000)
    return NextResponse.json({ erreur: "Image invalide ou trop lourde." }, { status: 413 });

  // La capture est conservée et jointe à la publication.
  const imageId = uid();
  const empreinte = await sha256(c.image);
  await stockage().set(`preuve:${imageId}`, { profilId: id, image: c.image, empreinte, ajouteeLe: new Date().toISOString() });
  const image = `/api/preuve/${imageId}`;

  let lecture: LectureCapture = { type: "autre", paris: [], solde: null, confiance: 0, remarques: "Lecture automatique indisponible (clé ANTHROPIC_API_KEY manquante).", message: "", modele: "" };
  if (iaConfiguree()) {
    try {
      lecture = await lireCapture(c.image, c.contexte);
    } catch (e) {
      if (e instanceof Anthropic.APIError) return NextResponse.json({ erreur: `Erreur de l'IA (${e.status ?? "réseau"}).`, image }, { status: 502 });
      return NextResponse.json({ erreur: (e as Error).message, image }, { status: 502 });
    }
  }

  const compte = (await stockage().get<EtatApp>(`etat:${profilPublic() || id}`)) ?? (await stockage().get<EtatApp>(`etat:${id}`));
  const controle = controler(lecture, compte?.paris ?? []);
  const texte = lecture.message || (controle.controles.length ? messageParDefaut(controle) : "");
  const brouillon = { titre: controle.controles.length ? titreBilan(controle.bilan) : "", texte };
  const parisPublies: Actu["paris"] = controle.controles.map((x) => ({
    selection: x.pari.selection,
    cote: x.pari.cote,
    mise: x.pari.mise,
    statut: x.pari.statut,
    profit: x.profit,
    verifie: !!x.correspondance,
  }));

  if (c.auto && controle.sure) {
    const a: Actu = { id: uid(), t: new Date().toISOString(), type: "resultat", titre: brouillon.titre, texte, image, bilan: controle.bilan, paris: parisPublies, auto: true };
    const notifications = await publier(a, new URL(req.url).origin);
    return NextResponse.json({ lecture, controle, image, empreinte, publie: a, notifications });
  }
  return NextResponse.json({ lecture, controle, image, empreinte, brouillon, paris: parisPublies });
}
