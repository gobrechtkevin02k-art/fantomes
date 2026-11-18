import { after, NextResponse } from "next/server";
import { cleProfil, stockage } from "@/lib/serveur/stockage";
import { fusionnerPlans, type MetaProfil, type PlanResume } from "@/lib/serveur/agent";
import { diffuser, estPublic, journaliser } from "@/lib/serveur/public";
import type { EtatApp } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CorpsSync {
  profilId?: string;
  etat?: EtatApp;
  ouverture?: boolean;
  plan?: PlanResume;
}

export async function POST(req: Request) {
  const texte = await req.text();
  if (texte.length > 2_000_000) return NextResponse.json({ erreur: "Données trop volumineuses." }, { status: 413 });
  let c: CorpsSync;
  try {
    c = JSON.parse(texte) as CorpsSync;
  } catch {
    return NextResponse.json({ erreur: "Requête invalide." }, { status: 400 });
  }
  const id = c.profilId ?? "";
  if (!cleProfil(id)) return NextResponse.json({ erreur: "Profil invalide." }, { status: 400 });
  const st = stockage();
  try {
    if (c.etat && typeof c.etat === "object" && c.etat.profilId === id && Array.isArray(c.etat.paris) && Array.isArray(c.etat.mouvements)) {
      // Compte public : chaque modification est inscrite dans le journal avant d'être enregistrée.
      if (estPublic(id)) {
        const nouveaux = await journaliser(c.etat, await st.get<EtatApp>(`etat:${id}`));
        const etat = c.etat;
        // Les abonnés qui suivent le compte sont prévenus après la réponse, sans faire attendre l'appli.
        if (nouveaux.length) after(() => diffuser(nouveaux, etat).catch(() => 0));
      }
      await st.set(`etat:${id}`, c.etat);
      await st.ajouterAEnsemble("profils", id);
    }
    if (c.ouverture || c.plan) {
      const meta = (await st.get<MetaProfil>(`meta:${id}`)) ?? {};
      if (c.ouverture) meta.derniereOuverture = new Date().toISOString();
      if (c.plan && typeof c.plan.jour === "string" && Array.isArray(c.plan.sessions)) meta.plan = fusionnerPlans(meta.plan, { ...c.plan, source: "client" });
      await st.set(`meta:${id}`, meta);
    }
    return NextResponse.json({ ok: true, stockage: st.type });
  } catch (e) {
    return NextResponse.json({ erreur: (e as Error).message }, { status: 502 });
  }
}

/** Récupère les données d'un profil (pour continuer sur un autre appareil). */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!cleProfil(id)) return NextResponse.json({ erreur: "Code invalide." }, { status: 400 });
  const etat = await stockage().get<EtatApp>(`etat:${id}`).catch(() => null);
  if (!etat) return NextResponse.json({ erreur: "Aucune donnée pour ce code." }, { status: 404 });
  return NextResponse.json({ etat });
}
