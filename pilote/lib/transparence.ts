// Transparence : journal public des opérations du compte (dépôts, retraits, paris, résultats, corrections).
//
// Le journal est construit côté serveur, en comparant chaque nouvelle version du compte à la précédente.
// Il ne fait qu'ajouter des entrées : une suppression ou une correction devient elle-même une entrée visible.
// Chaque entrée contient l'empreinte SHA-256 de la précédente (chaîne), ce qui rend toute retouche détectable.

import type { Cloture, EtatApp, Mouvement, Pari, ReleveSolde } from "./types";

// Réponse de /api/resultats (onglet Résultats).
export interface PariResultat extends Omit<Pari, "note"> {
  provisoire?: boolean; // réglé d'après le score officiel, en attente de synchronisation du compte
  score?: string; // score en direct
  scelle?: boolean; // détails masqués jusqu'au coup d'envoi (visiteurs non abonnés)
}

export interface Ancrage {
  jour: string; // AAAA-MM-JJ (heure de Paris)
  n: number; // numéro de la dernière entrée couverte
  hash: string; // empreinte de cette entrée
  t: string;
  ots?: boolean; // preuve OpenTimestamps disponible (/api/ancrage/<jour>)
  telegram?: string; // lien du message publié
}

export interface ReponseResultats {
  configure: boolean;
  derniereSynchro: string | null;
  depart: { bankrollInitiale: number; dateDebut: string; allocation: EtatApp["reglages"]["allocation"]; objectif: EtatApp["reglages"]["objectif"] } | null;
  paris: PariResultat[];
  mouvements: EtatApp["mouvements"];
  journal: Evenement[];
  releves: ReleveSolde[];
  clotures: Record<string, Cloture>;
  ancrages: Ancrage[];
  acces: "complet" | "differe"; // les visiteurs non abonnés voient les paris au coup d'envoi
  majLe: string;
}



export type TypeEvenement =
  | "ouverture"
  | "depot"
  | "retrait"
  | "ajustement"
  | "reequilibrage"
  | "mouvement_supprime"
  | "pari_place"
  | "pari_regle"
  | "pari_corrige"
  | "pari_supprime"
  | "preuve_ajoutee"
  | "releve_solde"
  | "releve_supprime"
  | "depart_modifie";

export interface PariPublic {
  id: string;
  mode: Pari["mode"];
  selections: { label: string; match: string; commence: string; cote: number }[];
  cote: number;
  mise: number;
  confiance: number;
  statut: Pari["statut"];
  gain?: number;
  auto?: boolean;
  preuve?: { numero?: string; photo?: string; empreinte?: string };
}

export interface DonneesEvenement {
  montant?: number;
  note?: string;
  pari?: PariPublic;
  avant?: Partial<PariPublic> & { bankrollInitiale?: number; dateDebut?: string };
  apres?: Partial<PariPublic> & { bankrollInitiale?: number; dateDebut?: string };
  anterieur?: boolean; // opération antérieure à l'ouverture du journal
  apresDebut?: boolean; // pari enregistré après le coup d'envoi
  bankrollInitiale?: number;
  dateDebut?: string;
  releve?: { soldeWinamax: number; soldePilote: number; ecart: number; photo?: string; empreinte?: string; date: string };
}

export interface Evenement {
  v: 2;
  n: number;
  t: string; // heure de réception par le serveur (fait foi)
  type: TypeEvenement;
  d?: DonneesEvenement; // absent tant que l'entrée est scellée (pari pas encore commencé)
  dh: string; // empreinte du contenu : le contenu révélé plus tard doit lui correspondre
  precedent: string;
  hash: string;
  apercu?: { mode: Pari["mode"]; mise: number; commence: string }; // ce qui est visible d'une entrée scellée
}

export type EvenementBrut = { type: TypeEvenement; d: DonneesEvenement };

export const pariPublic = (p: Pari): PariPublic => ({
  id: p.id,
  mode: p.mode,
  selections: p.jambes.map((j) => ({ label: j.label, match: `${j.home} – ${j.away}`, commence: j.commence, cote: j.odds })),
  cote: p.cote,
  mise: p.mise,
  confiance: Math.round(p.confiance),
  statut: p.statut,
  ...(p.gain !== undefined ? { gain: p.gain } : {}),
  ...(p.auto ? { auto: true } : {}),
  ...(p.preuve ? { preuve: { numero: p.preuve.numero, photo: p.preuve.photo, empreinte: p.preuve.empreinte } } : {}),
});

const releveEv = (r: ReleveSolde): DonneesEvenement["releve"] => ({
  soldeWinamax: r.soldeWinamax,
  soldePilote: r.soldePilote,
  ecart: Math.round((r.soldeWinamax - r.soldePilote) * 100) / 100,
  date: r.date,
  ...(r.photo ? { photo: r.photo } : {}),
  ...(r.empreinte ? { empreinte: r.empreinte } : {}),
});

const reel = (p: Pari) => !p.demo;
const debutPari = (p: Pari) => Math.min(...p.jambes.map((j) => Date.parse(j.commence)).filter(Number.isFinite));

function evenementsMouvement(m: Mouvement, anterieur = false): EvenementBrut {
  const type: TypeEvenement = m.type === "depot" ? "depot" : m.type === "retrait" ? "retrait" : m.type === "ajustement" ? "ajustement" : "reequilibrage";
  return { type, d: { montant: m.montant, ...(m.note ? { note: m.note } : {}), ...(anterieur ? { anterieur } : {}) } };
}

/** Les entrées à ajouter au journal entre deux versions du compte. */
export function differences(avant: EtatApp | null, apres: EtatApp, recuLe: number): EvenementBrut[] {
  const ev: EvenementBrut[] = [];
  const parisApres = apres.paris.filter(reel);

  if (!avant) {
    ev.push({ type: "ouverture", d: { bankrollInitiale: apres.reglages.bankrollInitiale, dateDebut: apres.reglages.dateDebut } });
    for (const m of [...apres.mouvements].sort((a, b) => a.date.localeCompare(b.date))) ev.push(evenementsMouvement(m, true));
    for (const p of [...parisApres].sort((a, b) => a.creeLe.localeCompare(b.creeLe))) {
      ev.push({ type: "pari_place", d: { pari: pariPublic({ ...p, statut: "en_cours", gain: undefined, auto: undefined, preuve: undefined }), anterieur: true } });
      if (p.preuve) ev.push({ type: "preuve_ajoutee", d: { pari: pariPublic(p), anterieur: true } });
      if (p.statut !== "en_cours") ev.push({ type: "pari_regle", d: { pari: pariPublic(p), anterieur: true } });
    }
    for (const r of apres.releves ?? []) ev.push({ type: "releve_solde", d: { releve: releveEv(r), anterieur: true } });
    return ev;
  }

  const ra = avant.reglages;
  const rb = apres.reglages;
  if (ra.bankrollInitiale !== rb.bankrollInitiale || ra.dateDebut.slice(0, 10) !== rb.dateDebut.slice(0, 10)) {
    ev.push({
      type: "depart_modifie",
      d: { avant: { bankrollInitiale: ra.bankrollInitiale, dateDebut: ra.dateDebut }, apres: { bankrollInitiale: rb.bankrollInitiale, dateDebut: rb.dateDebut } },
    });
  }

  const mvAvant = new Map(avant.mouvements.map((m) => [m.id, m]));
  const mvApres = new Map(apres.mouvements.map((m) => [m.id, m]));
  for (const m of apres.mouvements) if (!mvAvant.has(m.id)) ev.push(evenementsMouvement(m));
  for (const m of avant.mouvements) if (!mvApres.has(m.id)) ev.push({ type: "mouvement_supprime", d: { montant: m.montant, note: `${m.type} du ${m.date.slice(0, 10)}` } });

  const pAvant = new Map(avant.paris.filter(reel).map((p) => [p.id, p]));
  const pApres = new Map(parisApres.map((p) => [p.id, p]));
  for (const p of parisApres) {
    const a = pAvant.get(p.id);
    if (!a) {
      const enRetard = recuLe > debutPari(p) + 60_000;
      ev.push({ type: "pari_place", d: { pari: pariPublic({ ...p, statut: "en_cours", gain: undefined, auto: undefined, preuve: undefined }), ...(enRetard ? { apresDebut: true } : {}) } });
      if (p.preuve) ev.push({ type: "preuve_ajoutee", d: { pari: pariPublic(p) } });
      if (p.statut !== "en_cours") ev.push({ type: "pari_regle", d: { pari: pariPublic(p) } });
      continue;
    }
    if (p.preuve && (a.preuve?.numero !== p.preuve.numero || a.preuve?.empreinte !== p.preuve.empreinte)) ev.push({ type: "preuve_ajoutee", d: { pari: pariPublic(p) } });
    if (a.statut === "en_cours" && p.statut !== "en_cours") {
      ev.push({ type: "pari_regle", d: { pari: pariPublic(p) } });
    } else if (a.statut !== p.statut || a.mise !== p.mise || a.cote !== p.cote || (a.gain ?? 0) !== (p.gain ?? 0)) {
      ev.push({
        type: "pari_corrige",
        d: {
          pari: pariPublic(p),
          avant: { statut: a.statut, mise: a.mise, cote: a.cote, gain: a.gain },
          apres: { statut: p.statut, mise: p.mise, cote: p.cote, gain: p.gain },
        },
      });
    }
  }
  for (const a of pAvant.values()) if (!pApres.has(a.id)) ev.push({ type: "pari_supprime", d: { pari: pariPublic(a) } });

  const rAvant = new Map((avant.releves ?? []).map((r) => [r.id, r]));
  const rApres = new Map((apres.releves ?? []).map((r) => [r.id, r]));
  for (const r of apres.releves ?? []) if (!rAvant.has(r.id)) ev.push({ type: "releve_solde", d: { releve: releveEv(r) } });
  for (const r of avant.releves ?? []) if (!rApres.has(r.id)) ev.push({ type: "releve_supprime", d: { releve: releveEv(r) } });
  return ev;
}

/** Empreinte SHA-256 (hexadécimal) — fonctionne dans Node comme dans le navigateur. */
export async function sha256(texte: string): Promise<string> {
  const octets = new TextEncoder().encode(texte);
  const h = await crypto.subtle.digest("SHA-256", octets);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const contenu = (e: Pick<Evenement, "n" | "t" | "type" | "dh" | "precedent">) => JSON.stringify({ v: 2, n: e.n, t: e.t, type: e.type, dh: e.dh, precedent: e.precedent });
export const empreinteContenu = (d: DonneesEvenement) => sha256(JSON.stringify(d));

export async function chainer(journal: Evenement[], nouveaux: EvenementBrut[], recuLe: number): Promise<Evenement[]> {
  const out = [...journal];
  for (const e of nouveaux) {
    const dernier = out[out.length - 1];
    const base = { n: (dernier?.n ?? 0) + 1, t: new Date(recuLe).toISOString(), type: e.type, dh: await empreinteContenu(e.d), precedent: dernier?.hash ?? "0".repeat(64) };
    out.push({ v: 2, ...base, d: e.d, hash: await sha256(contenu(base)) });
  }
  return out;
}

/**
 * Vérifie la chaîne : retourne le numéro de la première entrée altérée, ou null si tout est intact.
 * Une entrée scellée (contenu masqué) est vérifiée sur son empreinte ; son contenu le sera une fois révélé.
 */
export async function verifierChaine(journal: Evenement[]): Promise<number | null> {
  let precedent = "0".repeat(64);
  for (const e of journal) {
    if (e.precedent !== precedent) return e.n;
    if ((await sha256(contenu(e))) !== e.hash) return e.n;
    if (e.d && (await empreinteContenu(e.d)) !== e.dh) return e.n;
    precedent = e.hash;
  }
  return null;
}

const debutDonnees = (d?: DonneesEvenement) => (d?.pari ? Math.min(...d.pari.selections.map((x) => Date.parse(x.commence)).filter(Number.isFinite)) : -Infinity);

/** Publication différée : les entrées d'un pari pas encore commencé sont scellées (contenu retiré, empreinte gardée). */
export function sceller(journal: Evenement[], maintenant: number): Evenement[] {
  const scelles = new Set(journal.filter((e) => e.type === "pari_place" && debutDonnees(e.d) > maintenant).map((e) => e.d!.pari!.id));
  return journal.map((e) => {
    const id = e.d?.pari?.id;
    if (!id || !scelles.has(id)) return e;
    const p = e.d!.pari!;
    const { d: _d, ...reste } = e;
    return { ...reste, apercu: { mode: p.mode, mise: p.mise, commence: new Date(debutDonnees(e.d)).toISOString() } };
  });
}
