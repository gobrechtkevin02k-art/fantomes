import { NextResponse } from "next/server";
import { coteDemo, scoresDemo } from "@/lib/demo";
import { cleApi, cotesLive, scoresLive } from "@/lib/oddsapi";
import { tacheProfil, type Dependances, type MetaProfil } from "@/lib/serveur/agent";
import { envoyer, pushConfigure } from "@/lib/serveur/push";
import { stockage } from "@/lib/serveur/stockage";
import { offreDe } from "@/lib/serveur/abonnements";
import { droitsDe } from "@/lib/offres";
import type { EtatApp, MarketKey, Pari } from "@/lib/types";
import { aRelever, calculerCloture, enregistrerCloture } from "@/lib/serveur/clv";
import { ancrerSiBesoin } from "@/lib/serveur/ancrage";
import { CLE_SYNCHRO, estPublic } from "@/lib/serveur/public";
import { cleJour } from "@/lib/engine/temps";

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
    if (!cleApi()) return scoresDemo(sports, Date.now(), 1);
    const res = await Promise.all(sports.map((s) => scoresLive(s, 1).catch(() => [])));
    return res.flat();
  },
};

/** Relève la cote de clôture des sélections jouées dont le match commence dans les 20 minutes. */
async function releverClotures(paris: Pari[], maintenant: number): Promise<number> {
  const cibles = await aRelever(paris, maintenant);
  if (!cibles.length) return 0;
  const sports = [...new Set(cibles.map((c) => c.sportKey))];
  const marches = [...new Set(cibles.map((c) => c.selectionId.split("|")[1]?.split(":")[0]))].filter((m): m is MarketKey => ["h2h", "totals", "spreads"].includes(m ?? ""));
  const events = cleApi()
    ? (await Promise.all(sports.map((s) => cotesLive(s, marches.length ? marches : ["h2h"], 2 * 60_000).catch(() => [])))).flat()
    : coteDemo(sports, maintenant - 30 * 60_000);
  let n = 0;
  for (const c of cibles) {
    const ev = events.find((e) => e.id === c.eventId);
    const cl = ev && calculerCloture(ev, c.selectionId, maintenant);
    if (cl) {
      await enregistrerCloture(c.selectionId, cl);
      n++;
    }
  }
  return n;
}

export async function GET(req: Request) {
  if (!autorise(req)) return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  const st = stockage();
  const maintenant = Date.now();
  const bilan: { profil: string; notifications: number; erreur?: string }[] = [];
  const profils = await st.membres("profils");
  const etats = new Map<string, EtatApp>();
  for (const id of profils) {
    const e = await st.get<EtatApp>(`etat:${id}`).catch(() => null);
    if (e?.onboarding) etats.set(id, e);
  }

  // Tâches qui ne dépendent pas des notifications : cote de clôture et ancrage du journal public.
  const clotures = await releverClotures([...etats.values()].flatMap((e) => e.paris), maintenant).catch(() => 0);
  const ancrage = await ancrerSiBesoin(maintenant).catch(() => null);

  if (!pushConfigure()) return NextResponse.json({ ok: true, clotures, ancrage: ancrage?.jour ?? null, info: "Notifications non configurées." });
  for (const [id, etat] of etats) {
    try {
      const meta = (await st.get<MetaProfil>(`meta:${id}`)) ?? {};
      const { offre } = await offreDe(id);
      const { notifications, meta: nouvelle } = await tacheProfil(etat, meta, maintenant, deps, droitsDe(offre));
      // Compte public : rappel au propriétaire si l'appli n'a pas synchronisé depuis 20 h alors que des paris sont en cours.
      if (estPublic(id)) {
        const sync = await st.get<string>(CLE_SYNCHRO);
        const jour = cleJour(maintenant, etat.reglages.conseiller.fuseau);
        const enCours = etat.paris.some((p) => p.statut === "en_cours" && !p.demo);
        if (enCours && sync && maintenant - Date.parse(sync) > 20 * 3_600_000 && nouvelle.rappelSynchro !== jour) {
          nouvelle.rappelSynchro = jour;
          notifications.push({
            titre: "🔄 Ton compte public attend une synchronisation",
            texte: "Ouvre Pilote une minute : tes abonnés voient que le compte n'a pas été mis à jour depuis plus de 20 heures.",
            url: "/",
            tag: `rappel-synchro-${jour}`,
          });
        }
      }
      let envoyees = 0;
      for (const n of notifications) envoyees += await envoyer(id, n);
      if (JSON.stringify(nouvelle) !== JSON.stringify(meta)) await st.set(`meta:${id}`, nouvelle);
      bilan.push({ profil: id.slice(0, 8), notifications: envoyees });
    } catch (e) {
      bilan.push({ profil: id.slice(0, 8), notifications: 0, erreur: (e as Error).message });
    }
  }
  return NextResponse.json({ ok: true, heure: new Date(maintenant).toISOString(), clotures, ancrage: ancrage?.jour ?? null, bilan });
}
