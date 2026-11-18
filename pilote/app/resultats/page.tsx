"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Pari } from "@/lib/types";
import type { Evenement, ReponseResultats } from "@/lib/transparence";
import { verifierChaine } from "@/lib/transparence";
import { calculerBankroll, statistiques, MODES } from "@/lib/engine/bankroll";
import { reglagesParDefaut, useStore } from "@/lib/store";
import { useDonnees } from "@/lib/donnees";
import { cote, dateCourte, dateLongue, depuis, eur, eurSigne, pct, pctSigne } from "@/lib/format";
import Graphique from "@/components/Graphique";
import { MeilleurPire, QualiteParis, Simulateur, StatsDetaillees } from "@/components/Analyses";
import { Badge, Bouton, COULEUR_MODE, Carte, NOM_MODE, Puces, Stat, Titre, Vide, cx } from "@/components/ui";
import { IcAlerte, IcTrophee } from "@/components/Icones";
import { Cadenas } from "@/components/Offres";

type Filtre = "tout" | "paris" | "argent" | "preuves" | "corrections";

const TZ = "Europe/Paris";
const fmtHeure = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
const nomPari = (p: { selections: { label: string }[] } | undefined) => (!p ? "Pari" : p.selections.length > 1 ? `Combiné de ${p.selections.length} sélections` : p.selections[0]?.label ?? "Pari");
const STATUT: Record<string, string> = { gagne: "Gagné", perdu: "Perdu", rembourse: "Remboursé", cashout: "Cash-out", en_cours: "En cours" };

interface Ligne {
  titre: string;
  detail?: string;
  montant?: number;
  couleur: string;
  categorie: Exclude<Filtre, "tout">;
  drapeaux: string[];
  liens?: { texte: string; url: string }[];
}

function decrire(e: Evenement): Ligne {
  if (!e.d) {
    const a = e.apercu;
    return {
      titre: `Pari scellé${a ? ` · ${NOM_MODE[a.mode]}` : ""}`,
      detail: a ? `Mise ${eur(a.mise)} · contenu révélé au coup d'envoi (${fmtHeure(a.commence)}). Son empreinte est déjà dans la chaîne : il ne pourra pas être modifié.` : undefined,
      couleur: "#8b97a4",
      categorie: "paris",
      drapeaux: ["Scellé"],
    };
  }
  const d = e.d;
  const drapeaux: string[] = [];
  if (d.anterieur) drapeaux.push("Antérieur à l'ouverture du journal");
  if (d.apresDebut) drapeaux.push("Enregistré après le coup d'envoi");
  const p = d.pari;
  const sel = p?.selections.map((s) => `${s.label} (${s.match})`).join(" + ");
  switch (e.type) {
    case "ouverture":
      return { titre: "Ouverture du journal", detail: `Premier dépôt de ${eur(d.bankrollInitiale ?? 0)} le ${dateLongue(d.dateDebut ?? e.t)}.`, montant: d.bankrollInitiale, couleur: "#e9eef3", categorie: "argent", drapeaux };
    case "depot":
      return { titre: "Dépôt (argent réinjecté)", detail: d.note, montant: d.montant, couleur: "#34d399", categorie: "argent", drapeaux };
    case "retrait":
      return { titre: "Retrait", detail: d.note, montant: d.montant, couleur: "#f87171", categorie: "argent", drapeaux };
    case "ajustement":
      return { titre: "Correction de solde (alignement sur le solde Winamax)", detail: d.note, montant: d.montant, couleur: "#fbbf24", categorie: "corrections", drapeaux };
    case "reequilibrage":
      return { titre: "Rééquilibrage des poches", detail: "Opération interne, sans effet sur le total.", couleur: "#8b97a4", categorie: "argent", drapeaux };
    case "mouvement_supprime":
      return { titre: "Opération supprimée", detail: `${d.note ?? ""} (${eurSigne(d.montant ?? 0)})`, couleur: "#fbbf24", categorie: "corrections", drapeaux: [...drapeaux, "Correction"] };
    case "pari_place":
      return {
        titre: `Pari placé · ${NOM_MODE[p!.mode]}`,
        detail: `${sel} · cote ${cote(p!.cote)} · mise ${eur(p!.mise)} · indice ${p!.confiance}`,
        couleur: COULEUR_MODE[p!.mode],
        categorie: "paris",
        drapeaux,
      };
    case "pari_regle": {
      const profit = (p!.gain ?? 0) - p!.mise;
      return {
        titre: `${STATUT[p!.statut] ?? "Réglé"} · ${nomPari(p)}`,
        detail: `Cote ${cote(p!.cote)} · mise ${eur(p!.mise)}${p!.auto ? " · réglé automatiquement d'après le score officiel" : " · réglé à la main"}`,
        montant: profit,
        couleur: profit > 0 ? "#34d399" : profit < 0 ? "#f87171" : "#8b97a4",
        categorie: "paris",
        drapeaux,
      };
    }
    case "pari_corrige":
      return {
        titre: `Correction d'un pari · ${nomPari(p)}`,
        detail: `Avant : ${STATUT[d.avant?.statut ?? ""] ?? d.avant?.statut}, mise ${eur(d.avant?.mise ?? 0)}, cote ${cote(d.avant?.cote ?? 0)} → après : ${STATUT[d.apres?.statut ?? ""] ?? d.apres?.statut}, mise ${eur(d.apres?.mise ?? 0)}, cote ${cote(d.apres?.cote ?? 0)}`,
        couleur: "#fbbf24",
        categorie: "corrections",
        drapeaux: [...drapeaux, "Correction"],
      };
    case "pari_supprime":
      return { titre: `Pari supprimé · ${nomPari(p)}`, detail: `${sel} · mise ${eur(p!.mise)} · état au moment de la suppression : ${STATUT[p!.statut]}`, couleur: "#fbbf24", categorie: "corrections", drapeaux: [...drapeaux, "Correction"] };
    case "preuve_ajoutee":
      return {
        titre: `Preuve Winamax · ${nomPari(p)}`,
        detail: [p?.preuve?.numero ? `Ticket n°${p.preuve.numero}` : null, p?.preuve?.empreinte ? `empreinte de la photo ${p.preuve.empreinte.slice(0, 16)}…` : null].filter(Boolean).join(" · "),
        couleur: "#34d399",
        categorie: "preuves",
        drapeaux,
        liens: p?.preuve?.photo ? [{ texte: "Voir le ticket", url: p.preuve.photo }] : undefined,
      };
    case "releve_solde":
    case "releve_supprime": {
      const r = d.releve!;
      return {
        titre: e.type === "releve_solde" ? "Relevé du solde Winamax" : "Relevé de solde supprimé",
        detail: `Winamax ${eur(r.soldeWinamax)} · Pilote ${eur(r.soldePilote)} · écart ${eurSigne(r.ecart)}`,
        couleur: e.type === "releve_solde" ? (Math.abs(r.ecart) < 0.01 ? "#34d399" : "#fbbf24") : "#fbbf24",
        categorie: e.type === "releve_solde" ? "preuves" : "corrections",
        drapeaux: e.type === "releve_supprime" ? [...drapeaux, "Correction"] : drapeaux,
        liens: r.photo ? [{ texte: "Voir la capture", url: r.photo }] : undefined,
      };
    }
    case "depart_modifie":
      return {
        titre: "Point de départ modifié",
        detail: `${eur(d.avant?.bankrollInitiale ?? 0)} le ${dateCourte(d.avant?.dateDebut ?? e.t)} → ${eur(d.apres?.bankrollInitiale ?? 0)} le ${dateCourte(d.apres?.dateDebut ?? e.t)}`,
        couleur: "#fbbf24",
        categorie: "corrections",
        drapeaux: [...drapeaux, "Correction"],
      };
  }
}

function BoutonSuivre() {
  const { pret, etat } = useStore();
  const { droits, notifier } = useDonnees();
  const [suit, setSuit] = useState<boolean | null>(null);
  useEffect(() => {
    if (!pret || !etat.onboarding) return;
    fetch(`/api/suivre?id=${encodeURIComponent(etat.profilId)}`)
      .then((r) => r.json())
      .then((d: { suit: boolean }) => setSuit(d.suit))
      .catch(() => {});
  }, [pret, etat.onboarding, etat.profilId]);
  if (!pret || !etat.onboarding) return null;
  if (!droits.notifMatin)
    return (
      <Link href="/offres" className="inline-flex items-center gap-1.5 rounded-xl border border-ligne px-3 py-2 text-[13px] font-semibold text-doux">
        <Cadenas /> Suivre ce compte
      </Link>
    );
  return (
    <Bouton
      variante={suit ? "contour" : "plein"}
      couleur="#fbbf24"
      className="min-h-10 text-[13px]"
      onClick={async () => {
        const res = await fetch("/api/suivre", { method: suit ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId: etat.profilId }) });
        const d = (await res.json()) as { suit?: boolean };
        setSuit(!!d.suit);
        notifier(d.suit ? "Tu seras prévenu à chaque pari et à chaque résultat (notifications activées requises)." : "Tu ne suis plus ce compte.", "info");
      }}
    >
      {suit ? "Ne plus suivre" : "🔔 Suivre ce compte"}
    </Bouton>
  );
}

async function partagerBilan(notifier: (t: string, ton?: "info" | "succes" | "alerte") => void) {
  try {
    const res = await fetch("/api/carte-bilan", { cache: "no-store" });
    const blob = await res.blob();
    const fichier = new File([blob], "pilote-bilan-du-mois.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: "Bilan du mois", text: "Mon bilan du mois sur Pilote, pertes comprises." });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fichier.name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  } catch {
    notifier("Partage annulé ou impossible.", "info");
  }
}

export default function Resultats() {
  const { pret, etat } = useStore();
  const { notifier } = useDonnees();
  const [r, setR] = useState<ReponseResultats | null>(null);
  const [erreur, setErreur] = useState(false);
  const [vue, setVue] = useState<"paris" | "bankroll">("paris");
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [nombre, setNombre] = useState(40);
  const [integrite, setIntegrite] = useState<"verification" | "ok" | number>("verification");
  const demandeur = pret && etat.onboarding ? etat.profilId : "";

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    const charger = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/resultats${demandeur ? `?id=${encodeURIComponent(demandeur)}` : ""}`, { cache: "no-store" });
        const d = (await res.json()) as ReponseResultats;
        if (actif) {
          setR(d);
          setErreur(false);
        }
      } catch {
        if (actif) setErreur(true);
      }
    };
    charger();
    const t = setInterval(charger, 30_000);
    return () => {
      actif = false;
      clearInterval(t);
    };
  }, [pret, demandeur]);

  const signatureChaine = r ? `${r.journal.length}:${r.journal[r.journal.length - 1]?.hash ?? ""}:${r.journal.filter((e) => e.d).length}` : "";
  useEffect(() => {
    if (!r) return;
    setIntegrite("verification");
    verifierChaine(r.journal)
      .then((n) => setIntegrite(n === null ? "ok" : n))
      .catch(() => setIntegrite("ok"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatureChaine]);

  const calc = useMemo(() => {
    if (!r?.depart) return null;
    const reglages = { ...reglagesParDefaut(), bankrollInitiale: r.depart.bankrollInitiale, dateDebut: r.depart.dateDebut, allocation: r.depart.allocation };
    const paris = r.paris as Pari[];
    const bk = calculerBankroll({ reglages, paris, mouvements: r.mouvements });
    const deposes = r.depart.bankrollInitiale + r.mouvements.filter((m) => m.type === "depot").reduce((t, m) => t + m.montant, 0);
    const retires = Math.abs(r.mouvements.filter((m) => m.type === "retrait").reduce((t, m) => t + m.montant, 0));
    const corrections = r.mouvements.filter((m) => m.type === "ajustement").reduce((t, m) => t + m.montant, 0);
    const stats = statistiques(paris);
    const regles = paris.filter((p) => p.statut !== "en_cours" && p.regleLe).sort((a, b) => Date.parse(a.regleLe!) - Date.parse(b.regleLe!));
    let cumul = 0;
    const courbe = [{ date: r.depart.dateDebut, total: 0 }, ...regles.map((p) => ({ date: p.regleLe!, total: (cumul += (p.gain ?? 0) - p.mise) }))];
    const avecPreuve = paris.filter((p) => p.preuve).length;
    return { bk, deposes, retires, corrections, stats, courbe, paris, avecPreuve };
  }, [r]);

  const lignes = useMemo(() => (r ? [...r.journal].reverse().map((e) => ({ e, l: decrire(e) })) : []), [r]);
  const visibles = lignes.filter(({ l }) => filtre === "tout" || l.categorie === filtre);
  const enCours = (r?.paris ?? []).filter((p) => p.statut === "en_cours" || p.provisoire);
  const hashParNumero = useMemo(() => new Map((r?.journal ?? []).map((e) => [e.n, e.hash])), [r]);
  const heuresSansSynchro = r?.derniereSynchro ? (Date.parse(r.majLe) - Date.parse(r.derniereSynchro)) / 3_600_000 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-jackpot/15 text-xl text-jackpot">
          <IcTrophee />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Résultats en toute transparence</h1>
          <p className="text-[14px] text-doux">
            Le compte réel, depuis le premier dépôt. Tout est visible : dépôts, retraits, argent réinjecté, chaque pari, chaque résultat, les preuves Winamax et même les corrections.
          </p>
        </div>
      </div>

      {!r ? (
        <div className="h-64 animate-pulse rounded-2xl border border-ligne bg-surface" />
      ) : !r.configure ? (
        <Vide titre="Les résultats publics ne sont pas encore ouverts" icone={<IcTrophee />}>
          Le compte public sera relié très bientôt.
        </Vide>
      ) : !calc ? (
        <Vide titre="Aucune opération pour l'instant" icone={<IcTrophee />}>
          Le journal s&apos;ouvrira au premier dépôt.
        </Vide>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-doux">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ligne bg-surface-2 px-2.5 py-1 font-semibold text-texte">
                <span className={cx("size-1.5 rounded-full", erreur ? "bg-negatif" : "animate-pulse bg-classique")} /> {erreur ? "Hors ligne" : "En direct"}
              </span>
              <span>Actualisé à {new Date(r.majLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              {r.derniereSynchro && <span>· compte synchronisé {depuis(r.derniereSynchro, Date.parse(r.majLe))}</span>}
            </div>
            <div className="flex gap-2">
              <BoutonSuivre />
              <Bouton variante="contour" className="min-h-10 text-[13px]" onClick={() => partagerBilan(notifier)}>
                Partager le bilan du mois
              </Bouton>
            </div>
          </div>

          {heuresSansSynchro > 24 && (
            <div className="flex items-start gap-3 rounded-2xl border border-jackpot/30 bg-jackpot/10 p-3.5 text-[13px] text-jackpot">
              <IcAlerte className="mt-0.5 shrink-0 text-base" />
              <p>
                <strong>Compte non synchronisé depuis {heuresSansSynchro >= 48 ? `${Math.floor(heuresSansSynchro / 24)} jours` : `${Math.floor(heuresSansSynchro)} heures`}.</strong> Les
                résultats des paris déjà enregistrés restent calculés en direct d&apos;après les scores officiels, mais de nouvelles opérations peuvent ne pas encore apparaître.
              </p>
            </div>
          )}

          {r.acces === "differe" && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-ligne bg-surface p-3.5 text-[13px] text-doux">
              <span>Tu vois chaque pari au coup d&apos;envoi. Les abonnés le voient dès qu&apos;il est placé, avec une notification.</span>
              <Link href="/offres" className="shrink-0 font-semibold text-jackpot">
                Voir les offres
              </Link>
            </div>
          )}

          <Carte>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Bankroll actuelle" valeur={eur(calc.bk.total)} grand sous={calc.bk.engageTotal > 0 ? `dont ${eur(calc.bk.engageTotal)} en jeu` : undefined} />
              <Stat
                label="Résultat des paris"
                valeur={eurSigne(calc.stats.profit)}
                couleur={calc.stats.profit >= 0 ? "#34d399" : "#f87171"}
                grand
                sous={`ROI ${pctSigne(calc.stats.roi)} sur ${eur(calc.stats.misesReglees, 0)} misés`}
              />
              <Stat label="Argent déposé" valeur={eur(calc.deposes)} sous={`dont 1er dépôt ${eur(r.depart!.bankrollInitiale)} le ${dateCourte(r.depart!.dateDebut)}`} />
              <Stat label="Argent retiré" valeur={eur(calc.retires)} sous={calc.corrections ? `corrections de solde ${eurSigne(calc.corrections)}` : "aucune correction de solde"} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-ligne pt-3 text-[12px]">
              <Stat label="Paris réglés" valeur={String(calc.stats.regles)} sous={`${calc.stats.gagnes} gagnés · ${calc.stats.perdus} perdus`} />
              <Stat label="Réussite" valeur={pct(calc.stats.tauxReussite, 0)} />
              <Stat label="Avec preuve Winamax" valeur={calc.paris.length ? pct(calc.avecPreuve / calc.paris.length, 0) : "—"} sous={`${calc.avecPreuve} sur ${calc.paris.length}`} />
            </div>
            <p className="num mt-4 rounded-xl bg-surface-2 p-3 text-[12px] leading-relaxed text-doux">
              {eur(calc.bk.total)} = {eur(calc.deposes)} déposés − {eur(calc.retires)} retirés {calc.corrections ? `${calc.corrections >= 0 ? "+" : "−"} ${eur(Math.abs(calc.corrections))} de corrections ` : ""}
              {calc.stats.profit >= 0 ? "+" : "−"} {eur(Math.abs(calc.stats.profit))} de résultat des paris. Seul ce dernier chiffre mesure la performance : l&apos;argent déposé ou retiré n&apos;est jamais compté comme un gain.
            </p>
          </Carte>

          <Carte>
            <Titre sous={vue === "paris" ? "Gains et pertes des paris uniquement, sans les dépôts ni les retraits." : "Total du compte, dépôts et retraits compris."}>Évolution</Titre>
            <div className="mb-3">
              <Puces
                label="Courbe"
                valeur={vue}
                onChange={setVue}
                options={[
                  { v: "paris", l: "Résultat des paris" },
                  { v: "bankroll", l: "Bankroll" },
                ]}
              />
            </div>
            {vue === "paris" ? (
              <Graphique points={[...calc.courbe, { date: r.majLe, total: calc.stats.profit }]} depart={0} hauteur={170} />
            ) : (
              <Graphique points={[...calc.bk.historique, { date: r.majLe, total: calc.bk.total }]} depart={r.depart!.bankrollInitiale} objectif={r.depart!.objectif?.montant} hauteur={170} />
            )}
          </Carte>

          {enCours.length > 0 && (
            <Carte accent="#fbbf24">
              <Titre sous="Mis à jour toutes les 30 secondes.">En ce moment</Titre>
              <ul className="space-y-2">
                {enCours.map((p) => {
                  const profit = (p.gain ?? 0) - p.mise;
                  const debut = Math.min(...p.jambes.map((j) => Date.parse(j.commence)));
                  return (
                    <li key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-ligne bg-surface-2/50 p-3 text-[13px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">{p.scelle ? "Pari scellé" : p.jambes.length > 1 ? `Combiné de ${p.jambes.length} sélections` : p.jambes[0]?.label}</span>
                          <Badge couleur={COULEUR_MODE[p.mode]}>{NOM_MODE[p.mode]}</Badge>
                          {p.provisoire && <Badge couleur="#34d399">Résultat officiel</Badge>}
                          {p.preuve && <Badge couleur="#34d399">🧾 Ticket</Badge>}
                        </div>
                        <div className="truncate text-[12px] text-doux">
                          {p.scelle ? `Révélé au coup d'envoi, ${fmtHeure(new Date(debut).toISOString())}` : (p.score ?? p.jambes.map((j) => `${j.home} – ${j.away}`).join(" | "))}
                        </div>
                      </div>
                      <div className="num shrink-0 text-right">
                        {p.statut === "en_cours" ? (
                          <>
                            <div className="font-semibold">{eur(p.mise)}</div>
                            {!p.scelle && <div className="text-[12px] text-doux">@ {cote(p.cote)}</div>}
                          </>
                        ) : (
                          <div className="font-bold" style={{ color: profit >= 0 ? "#34d399" : "#f87171" }}>
                            {eurSigne(profit)}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Carte>
          )}

          <MeilleurPire paris={calc.paris} tz={TZ} depart={r.depart!.bankrollInitiale} />
          <QualiteParis paris={calc.paris} clotures={r.clotures} />
          <StatsDetaillees paris={calc.paris} tz={TZ} />

          <Carte>
            <Titre sous="Le mode Classique est le seul accompagné par le conseiller ; les modes fun sont à haut risque.">Par gamme</Titre>
            <div className="divide-y divide-ligne">
              {MODES.map((m) => {
                const s = statistiques(calc.paris, m);
                return (
                  <div key={m} className="grid grid-cols-4 items-center gap-2 py-2.5 text-[13px]">
                    <span className="font-semibold" style={{ color: COULEUR_MODE[m] }}>
                      {NOM_MODE[m]}
                    </span>
                    <span className="num text-doux">{s.regles} réglés</span>
                    <span className="num text-doux">{s.regles ? `${pct(s.tauxReussite, 0)} réussis` : "—"}</span>
                    <span className="num text-right font-semibold" style={{ color: s.profit >= 0 ? "#34d399" : "#f87171" }}>
                      {eurSigne(s.profit)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Carte>

          <Simulateur paris={calc.paris.filter((p) => !(p as { scelle?: boolean }).scelle)} mouvements={r.mouvements} bankrollInitiale={r.depart!.bankrollInitiale} dateDebut={r.depart!.dateDebut} />

          {r.releves.length > 0 && (
            <Carte>
              <Titre sous="Chaque mois, le solde affiché par Winamax est comparé à celui calculé par Pilote.">Relevés de solde Winamax</Titre>
              <ul className="divide-y divide-ligne text-[13px]">
                {[...r.releves].reverse().map((rl) => {
                  const ecart = Math.round((rl.soldeWinamax - rl.soldePilote) * 100) / 100;
                  return (
                    <li key={rl.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span>{dateLongue(rl.date)}</span>
                      <span className="num text-doux">
                        Winamax {eur(rl.soldeWinamax)} · Pilote {eur(rl.soldePilote)} ·{" "}
                        <span style={{ color: Math.abs(ecart) < 0.01 ? "#34d399" : "#fbbf24" }}>{Math.abs(ecart) < 0.01 ? "identiques" : `écart ${eurSigne(ecart)}`}</span>
                        {rl.photo && (
                          <a href={rl.photo} target="_blank" rel="noopener noreferrer" className="ml-2 text-objectif underline">
                            capture
                          </a>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Carte>
          )}

          <Carte>
            <Titre sous={`${r.journal.length} entrée${r.journal.length > 1 ? "s" : ""}, de la plus récente à la plus ancienne. Rien ne peut en être retiré.`}>Journal du compte</Titre>
            <div className="-mx-1 mb-3 overflow-x-auto px-1">
              <Puces
                label="Filtrer le journal"
                valeur={filtre}
                onChange={(v) => {
                  setFiltre(v);
                  setNombre(40);
                }}
                options={[
                  { v: "tout", l: "Tout" },
                  { v: "paris", l: "Paris" },
                  { v: "argent", l: "Dépôts et retraits" },
                  { v: "preuves", l: "Preuves" },
                  { v: "corrections", l: "Corrections" },
                ]}
              />
            </div>
            {visibles.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-doux">Rien dans cette catégorie.</p>
            ) : (
              <ul className="divide-y divide-ligne">
                {visibles.slice(0, nombre).map(({ e, l }) => (
                  <li key={e.n} className="flex items-start gap-3 py-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: l.couleur }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[14px] font-semibold">{l.titre}</span>
                        {l.montant !== undefined && (
                          <span className="num shrink-0 text-[14px] font-bold" style={{ color: l.couleur }}>
                            {e.type === "ouverture" ? eur(l.montant) : eurSigne(l.montant)}
                          </span>
                        )}
                      </div>
                      {l.detail && <p className="text-[12px] leading-relaxed text-doux">{l.detail}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-faible">
                        <span className="num">
                          n°{e.n} · {fmtHeure(e.t)}
                        </span>
                        {l.drapeaux.map((f) => (
                          <Badge key={f} couleur={f === "Scellé" ? "#8b97a4" : "#fbbf24"}>
                            {f}
                          </Badge>
                        ))}
                        {l.liens?.map((x) => (
                          <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-objectif underline">
                            {x.texte}
                          </a>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {visibles.length > nombre && (
              <button onClick={() => setNombre((n) => n + 40)} className="mt-2 w-full rounded-xl border border-ligne py-2.5 text-[13px] font-semibold text-doux hover:text-texte">
                Voir plus ({visibles.length - nombre} restantes)
              </button>
            )}
          </Carte>

          <Carte>
            <Titre>Journal scellé et ancré</Titre>
            <p className="text-[13px] leading-relaxed text-doux">
              Chaque entrée contient l&apos;empreinte numérique (SHA-256) de la précédente : modifier ou effacer une seule ligne casserait toute la chaîne. Ton navigateur vient de
              recalculer la chaîne complète :{" "}
              {integrite === "verification" ? (
                <span className="font-semibold text-texte">vérification…</span>
              ) : integrite === "ok" ? (
                <span className="font-semibold text-positif">intacte ✓</span>
              ) : (
                <span className="font-semibold text-negatif">altérée à partir de l&apos;entrée n°{integrite} ✗</span>
              )}
            </p>
            {r.journal.length > 0 && <p className="num mt-2 break-all rounded-lg bg-surface-2 p-2.5 text-[11px] text-faible">Empreinte actuelle : {r.journal[r.journal.length - 1].hash}</p>}

            <div className="mt-4 border-t border-ligne pt-3">
              <div className="text-[13px] font-medium">Ancrages hors de Pilote</div>
              <p className="mt-1 text-[12px] leading-relaxed text-doux">
                Chaque jour, l&apos;empreinte du journal est publiée là où personne ne peut la modifier : horodatage OpenTimestamps (inscrit dans la blockchain Bitcoin) et, si activé, un
                canal Telegram public. Pour vérifier une preuve, télécharge les deux fichiers et dépose-les sur opentimestamps.org.
              </p>
              {r.ancrages.length === 0 ? (
                <p className="mt-2 text-[12px] text-faible">Le premier ancrage aura lieu dans la journée qui suit l&apos;ouverture du journal.</p>
              ) : (
                <ul className="mt-2 divide-y divide-ligne text-[12px]">
                  {[...r.ancrages].reverse().slice(0, 14).map((a) => {
                    const h = hashParNumero.get(a.n);
                    const conforme = h === a.hash;
                    return (
                      <li key={a.jour} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <span className="num">
                          {dateLongue(a.jour)} · entrée n°{a.n} ·{" "}
                          <span className={conforme ? "text-positif" : h ? "text-negatif" : "text-doux"}>{conforme ? "conforme ✓" : h ? "ne correspond plus ✗" : "—"}</span>
                        </span>
                        <span className="flex gap-3">
                          <a href={`/api/ancrage/${a.jour}`} className="text-objectif underline">
                            empreinte
                          </a>
                          {a.ots && (
                            <a href={`/api/ancrage/${a.jour}?format=ots`} className="text-objectif underline">
                              preuve .ots
                            </a>
                          )}
                          {a.telegram && (
                            <a href={a.telegram} target="_blank" rel="noopener noreferrer" className="text-objectif underline">
                              Telegram
                            </a>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="mt-3 text-[11px] text-faible">
              L&apos;heure de chaque entrée est celle de sa réception par le serveur, pas celle déclarée par l&apos;appli : un pari enregistré après le coup d&apos;envoi est signalé.
            </p>
          </Carte>

          <p className="text-[11px] leading-relaxed text-faible">
            Les résultats passés ne préjugent pas des résultats futurs. Les paris sportifs comportent un risque de perte. Interdit aux moins de 18 ans. Pour être aidé, appelez le 09 74 75 13 13
            (appel non surtaxé).
          </p>
        </>
      )}
    </div>
  );
}
