import { NextResponse } from "next/server";
import { scoresDemo } from "@/lib/demo";
import { cleApi, scoresLive } from "@/lib/oddsapi";
import { reglerParis } from "@/lib/engine/reglement";
import { CLE_JOURNAL, CLE_SYNCHRO, profilPublic } from "@/lib/serveur/public";
import { stockage } from "@/lib/serveur/stockage";
import type { Evenement, PariResultat, ReponseResultats } from "@/lib/transparence";
import type { EtatApp } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Résultats publics du compte réel (onglet Résultats), avec les résultats en direct. */
export async function GET() {
  const id = profilPublic();
  const vide: ReponseResultats = { configure: false, derniereSynchro: null, depart: null, paris: [], mouvements: [], journal: [], majLe: new Date().toISOString() };
  if (!id) return NextResponse.json(vide);
  const st = stockage();
  const [etat, journal, sync] = await Promise.all([st.get<EtatApp>(`etat:${id}`), st.get<Evenement[]>(CLE_JOURNAL), st.get<string>(CLE_SYNCHRO)]);
  if (!etat) return NextResponse.json({ ...vide, configure: true, journal: journal ?? [] });

  const maintenant = Date.now();
  const reels: PariResultat[] = etat.paris.filter((p) => !p.demo).map(({ note: _note, ...p }) => p);

  // Temps réel : scores des matchs en cours et règlement provisoire des matchs terminés.
  const enJeu = reels.filter((p) => p.statut === "en_cours" && p.jambes.some((j) => j.statut === "en_cours" && Date.parse(j.commence) <= maintenant));
  if (enJeu.length) {
    const sports = [...new Set(enJeu.flatMap((p) => p.jambes.map((j) => j.sportKey)))].slice(0, 10);
    const scores = cleApi() ? (await Promise.all(sports.map((s) => scoresLive(s, 1).catch(() => [])))).flat() : scoresDemo(sports, maintenant, 1);
    const regles = new Map(reglerParis(enJeu, scores, maintenant).map((p) => [p.id, p]));
    const parId = new Map(scores.map((s) => [s.id, s]));
    for (let i = 0; i < reels.length; i++) {
      const p = reels[i];
      const r = regles.get(p.id);
      if (r && r.statut !== "en_cours") reels[i] = { ...r, provisoire: true };
      else if (p.statut === "en_cours") {
        const live = p.jambes
          .map((j) => {
            const s = parId.get(j.eventId);
            if (!s?.scores || s.completed || Date.parse(j.commence) > maintenant) return null;
            const h = s.scores.find((x) => x.name === j.home)?.score;
            const a = s.scores.find((x) => x.name === j.away)?.score;
            return h !== undefined && a !== undefined ? `${j.home} ${h}-${a} ${j.away}` : null;
          })
          .filter(Boolean)
          .join(" | ");
        if (live) reels[i] = { ...(r ?? p), score: live };
      }
    }
  }

  const corps: ReponseResultats = {
    configure: true,
    derniereSynchro: sync ?? null,
    depart: { bankrollInitiale: etat.reglages.bankrollInitiale, dateDebut: etat.reglages.dateDebut, allocation: etat.reglages.allocation, objectif: etat.reglages.objectif },
    paris: reels,
    mouvements: etat.mouvements,
    journal: journal ?? [],
    majLe: new Date(maintenant).toISOString(),
  };
  return NextResponse.json(corps, { headers: { "Cache-Control": "no-store" } });
}
