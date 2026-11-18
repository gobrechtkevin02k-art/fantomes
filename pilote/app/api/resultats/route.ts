import { NextResponse } from "next/server";
import { scoresDemo } from "@/lib/demo";
import { cleApi, scoresLive } from "@/lib/oddsapi";
import { reglerParis } from "@/lib/engine/reglement";
import { CLE_JOURNAL, CLE_SYNCHRO, estPublic, profilPublic } from "@/lib/serveur/public";
import { CLE_ANCRAGES } from "@/lib/serveur/ancrage";
import { cloturesPour } from "@/lib/serveur/clv";
import { offreDe } from "@/lib/serveur/abonnements";
import { cleProfil, stockage } from "@/lib/serveur/stockage";
import { sceller, type Ancrage, type Evenement, type PariResultat, type ReponseResultats } from "@/lib/transparence";
import type { EtatApp } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Résultats publics du compte réel (onglet Résultats), avec les résultats en direct.
 * Publication différée : les visiteurs sans offre payante voient chaque pari au coup d'envoi ;
 * avant, il est scellé (son empreinte est publiée, son contenu révélé ensuite).
 */
export async function GET(req: Request) {
  const id = profilPublic();
  const maintenant = Date.now();
  const vide: ReponseResultats = {
    configure: false,
    derniereSynchro: null,
    depart: null,
    paris: [],
    mouvements: [],
    journal: [],
    releves: [],
    clotures: {},
    ancrages: [],
    acces: "differe",
    majLe: new Date(maintenant).toISOString(),
  };
  if (!id) return NextResponse.json(vide);

  const demandeur = new URL(req.url).searchParams.get("id") ?? "";
  const complet = cleProfil(demandeur) && (estPublic(demandeur) || (await offreDe(demandeur)).offre !== "decouverte");
  const st = stockage();
  const [etat, journalBrut, sync, ancrages] = await Promise.all([
    st.get<EtatApp>(`etat:${id}`),
    st.get<Evenement[]>(CLE_JOURNAL),
    st.get<string>(CLE_SYNCHRO),
    st.get<Ancrage[]>(CLE_ANCRAGES),
  ]);
  const journal = complet ? (journalBrut ?? []) : sceller(journalBrut ?? [], maintenant);
  if (!etat) return NextResponse.json({ ...vide, configure: true, journal, ancrages: ancrages ?? [], acces: complet ? "complet" : "differe" });

  let reels: PariResultat[] = etat.paris.filter((p) => !p.demo).map(({ note: _note, ...p }) => p);

  // Temps réel : scores des matchs en cours et règlement provisoire des matchs terminés.
  const enJeu = reels.filter((p) => p.statut === "en_cours" && p.jambes.some((j) => j.statut === "en_cours" && Date.parse(j.commence) <= maintenant));
  if (enJeu.length) {
    const sports = [...new Set(enJeu.flatMap((p) => p.jambes.map((j) => j.sportKey)))].slice(0, 10);
    const scores = cleApi() ? (await Promise.all(sports.map((s) => scoresLive(s, 1).catch(() => [])))).flat() : scoresDemo(sports, maintenant, 1);
    const regles = new Map(reglerParis(enJeu, scores, maintenant).map((p) => [p.id, p]));
    const parId = new Map(scores.map((s) => [s.id, s]));
    reels = reels.map((p) => {
      const r = regles.get(p.id);
      if (r && r.statut !== "en_cours") return { ...r, provisoire: true };
      if (p.statut !== "en_cours") return p;
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
      return live ? { ...(r ?? p), score: live } : p;
    });
  }

  // Publication différée : contenu des paris pas encore commencés masqué pour les visiteurs non abonnés.
  if (!complet) {
    reels = reels.map((p) => {
      const debut = Math.min(...p.jambes.map((j) => Date.parse(j.commence)));
      if (p.statut !== "en_cours" || debut <= maintenant) return p;
      return {
        ...p,
        scelle: true,
        cote: 0,
        confiance: 0,
        edge: 0,
        preuve: undefined,
        jambes: p.jambes.map((j) => ({ ...j, selectionId: "", eventId: "", label: "Pari scellé", home: "", away: "", issue: "", odds: 0, fairProb: 0 })),
      };
    });
  }

  const clotures = await cloturesPour(reels.filter((p) => !p.scelle).flatMap((p) => p.jambes.map((j) => j.selectionId)));

  const corps: ReponseResultats = {
    configure: true,
    derniereSynchro: sync ?? null,
    depart: { bankrollInitiale: etat.reglages.bankrollInitiale, dateDebut: etat.reglages.dateDebut, allocation: etat.reglages.allocation, objectif: etat.reglages.objectif },
    paris: reels,
    mouvements: etat.mouvements,
    journal,
    releves: etat.releves ?? [],
    clotures,
    ancrages: ancrages ?? [],
    acces: complet ? "complet" : "differe",
    majLe: new Date(maintenant).toISOString(),
  };
  return NextResponse.json(corps, { headers: { "Cache-Control": "no-store" } });
}
