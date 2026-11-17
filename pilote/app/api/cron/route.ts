import { NextResponse } from "next/server";
import { coteDemo, scoresDemo } from "@/lib/demo";
import { cleApi, cotesLive, scoresLive } from "@/lib/oddsapi";
import { tacheProfil, type Dependances, type MetaProfil } from "@/lib/serveur/agent";
import { envoyer, pushConfigure } from "@/lib/serveur/push";
import { stockage } from "@/lib/serveur/stockage";
import type { EtatApp } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// À appeler toutes les 15 minutes (Vercel Cron, cron-job.org…). Protégé par CRON_SECRET.
function autorise(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const u = new URL(req.url);
  return req.headers.get("authorization") === `Bearer ${secret}` || u.searchParams.get("cle") === secret;
}

const deps: Dependances = {
  async cotes(sports, marches) {
    if (!cleApi()) return coteDemo(sports);
    const res = await Promise.all(sports.map((s) => cotesLive(s, marches).catch(() => [])));
    return res.flat();
  },
  async scores(sports) {
    if (!cleApi()) return scoresDemo(sports);
    const res = await Promise.all(sports.map((s) => scoresLive(s, 3).catch(() => [])));
    return res.flat();
  },
};

export async function GET(req: Request) {
  if (!autorise(req)) return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  if (!pushConfigure()) return NextResponse.json({ ok: true, info: "Notifications non configurées : rien à faire." });
  const st = stockage();
  const maintenant = Date.now();
  const bilan: { profil: string; notifications: number; erreur?: string }[] = [];
  for (const id of await st.membres("profils")) {
    try {
      const etat = await st.get<EtatApp>(`etat:${id}`);
      if (!etat?.onboarding) continue;
      const meta = (await st.get<MetaProfil>(`meta:${id}`)) ?? {};
      const { notifications, meta: nouvelle } = await tacheProfil(etat, meta, maintenant, deps);
      let envoyees = 0;
      for (const n of notifications) envoyees += await envoyer(id, n);
      if (JSON.stringify(nouvelle) !== JSON.stringify(meta)) await st.set(`meta:${id}`, nouvelle);
      bilan.push({ profil: id.slice(0, 8), notifications: envoyees });
    } catch (e) {
      bilan.push({ profil: id.slice(0, 8), notifications: 0, erreur: (e as Error).message });
    }
  }
  return NextResponse.json({ ok: true, heure: new Date(maintenant).toISOString(), bilan });
}
