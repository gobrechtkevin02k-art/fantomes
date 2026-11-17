"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useCalculs, useDonnees } from "@/lib/donnees";
import { statistiques } from "@/lib/engine/bankroll";
import { cote, dateLongue, eur, eurSigne, pct, pctSigne } from "@/lib/format";
import Graphique from "@/components/Graphique";
import CarteConseiller from "@/components/Conseiller";
import CarteDirect from "@/components/Direct";
import { Badge, Barre, Bouton, COULEUR_MODE, Carte, NOM_MODE, Stat, Titre } from "@/components/ui";
import { IcAlerte, IcBouclier, IcChevron, IcCible, IcDiamant, IcEclair, IcRafraichir } from "@/components/Icones";
import type { Mode } from "@/lib/types";

const ICONES: Record<Mode, typeof IcBouclier> = { classique: IcBouclier, objectif: IcCible, jackpot: IcDiamant };
const LIENS: Record<Mode, string> = { classique: "/classique", objectif: "/objectif", jackpot: "/jackpot" };

function Objectif() {
  const { etat } = useStore();
  const { proj, bk } = useCalculs();
  const obj = etat.reglages.objectif;
  if (!obj) {
    return (
      <Carte>
        <Titre sous="Fixe un montant et une date : Pilote te dira si tu es dans les temps.">Objectif</Titre>
        <Link href="/reglages#objectif" className="text-[14px] font-semibold text-objectif">
          Définir un objectif →
        </Link>
      </Carte>
    );
  }
  const textes: Record<string, string> = {
    atteint: "Objectif atteint. Pense à sécuriser une partie des gains (retrait).",
    en_avance: "En avance sur le rythme nécessaire.",
    dans_les_temps: "Dans les temps.",
    en_retard: "En retard sur le rythme nécessaire.",
    indetermine: "Encore trop tôt pour juger du rythme (il faut 10 paris réglés et 2 semaines).",
  };
  const couleurs: Record<string, string> = { atteint: "#34d399", en_avance: "#34d399", dans_les_temps: "#a3e635", en_retard: "#fbbf24", indetermine: "#8b97a4" };
  return (
    <Carte>
      <Titre sous={`${eur(obj.montant, 0)} avant le ${dateLongue(obj.date)}`} action={<Badge couleur={couleurs[proj.statut]}>{proj.statut === "indetermine" ? "En rodage" : textes[proj.statut].split(".")[0]}</Badge>}>
        Objectif
      </Titre>
      <div className="num mb-2 flex items-baseline justify-between">
        <span className="text-2xl font-bold">{pct(proj.progression, 0)}</span>
        <span className="text-[13px] text-doux">
          {eur(bk.total, 0)} / {eur(obj.montant, 0)}
        </span>
      </div>
      <Barre valeur={proj.progression} couleur="linear-gradient(90deg,#34d399,#a78bfa)" hauteur={8} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="Rythme nécessaire" valeur={proj.statut === "atteint" ? "—" : `${pctSigne(proj.croissanceRequise)}/mois`} />
        <Stat label="Rythme actuel" valeur={proj.croissanceObservee === null ? "—" : `${pctSigne(proj.croissanceObservee)}/mois`} sous={proj.dateEstimee ? `Atteint vers le ${dateLongue(proj.dateEstimee)}` : undefined} />
      </div>
      <p className="mt-3 text-[13px] text-doux">{textes[proj.statut]}</p>
      {proj.ambitieux && proj.statut !== "atteint" && (
        <p className="mt-2 flex gap-2 rounded-xl bg-alerte/10 p-3 text-[12px] text-alerte">
          <IcAlerte className="mt-0.5 shrink-0" />
          Objectif très ambitieux (plus de 15 %/mois). Pilote n&apos;augmentera pas les mises pour le rattraper : c&apos;est exactement comme ça qu&apos;on perd une bankroll. Repousse la date
          ou baisse le montant pour un objectif tenable.
        </p>
      )}
    </Carte>
  );
}

export default function Accueil() {
  const { etat } = useStore();
  const { source, verifierResultats, notifier, maintenant } = useDonnees();
  const { bk, prot } = useCalculs();

  const [sessionCible, setSessionCible] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("session");
    if (id) {
      setSessionCible(id);
      window.history.replaceState(null, "", "/");
    }
  }, []);
  const stats = useMemo(() => statistiques(etat.paris), [etat.paris]);
  const enCours = etat.paris.filter((p) => p.statut === "en_cours");
  const delta = bk.total - bk.apports;
  const roiBk = bk.apports > 0 ? delta / bk.apports : 0;

  return (
    <div className="space-y-4">
      {source === "demo" && (
        <div className="flex items-start gap-3 rounded-2xl border border-jackpot/30 bg-jackpot/10 p-3.5 text-[13px] text-jackpot">
          <IcEclair className="mt-0.5 shrink-0 text-base" />
          <p>
            <strong>Mode démo :</strong> matchs et cotes simulés pour découvrir l&apos;outil. Ajoute ta clé The Odds API pour recevoir les vraies cotes Winamax.{" "}
            <Link href="/reglages#donnees" className="font-semibold underline underline-offset-2">
              Comment faire
            </Link>
          </p>
        </div>
      )}

      {(prot.bloque || prot.prudence) && (
        <div className="flex items-start gap-3 rounded-2xl border border-negatif/30 bg-negatif/10 p-3.5 text-[13px] text-negatif">
          <IcAlerte className="mt-0.5 shrink-0 text-base" />
          <div>
            {prot.bloque ? (
              <>
                <strong>Paris en pause.</strong> {prot.raisons.join(" ")} Les mises recommandées reviendront automatiquement.
              </>
            ) : (
              <>
                <strong>Mode prudence activé :</strong> ta bankroll a baissé de {pct(bk.drawdown, 0)} depuis son plus haut. Les mises sont divisées par deux jusqu&apos;à ce que ça remonte.
              </>
            )}
          </div>
        </div>
      )}

      <CarteDirect />
      <CarteConseiller sessionCible={sessionCible} />

      <Carte>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] text-doux">Bankroll totale</div>
            <div className="num text-[34px] font-bold leading-tight tracking-tight">{eur(bk.total)}</div>
            <div className="num text-[14px] font-semibold" style={{ color: delta >= 0 ? "#34d399" : "#f87171" }}>
              {eurSigne(delta)} ({pctSigne(roiBk)}) <span className="font-normal text-doux">depuis le départ</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12px] text-doux">En jeu</div>
            <div className="num text-[17px] font-semibold">{eur(bk.engageTotal)}</div>
            <div className="num text-[12px] text-doux">
              {enCours.length} pari{enCours.length > 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Graphique points={[...bk.historique, { date: new Date(maintenant).toISOString(), total: bk.total }]} depart={bk.apports} objectif={etat.reglages.objectif?.montant} hauteur={130} />
        </div>
      </Carte>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {(["classique", "objectif", "jackpot"] as Mode[]).map((m) => {
          const Icone = ICONES[m];
          const c = COULEUR_MODE[m];
          return (
            <Link key={m} href={LIENS[m]} className="group rounded-2xl border border-ligne bg-surface p-3 transition hover:bg-surface-2">
              <div className="flex items-center justify-between">
                <Icone className="text-lg" style={{ color: c }} />
                <IcChevron className="text-faible transition group-hover:translate-x-0.5" />
              </div>
              <div className="mt-2 truncate text-[12px] text-doux">{NOM_MODE[m]}</div>
              <div className="num text-[15px] font-bold sm:text-[17px]">{eur(bk.poches[m])}</div>
              {bk.engage[m] > 0 && <div className="num text-[11px] text-faible">+ {eur(bk.engage[m])} en jeu</div>}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Objectif />
        <div className="space-y-4">
          <Carte>
            <Titre
              sous={enCours.length ? `${eur(bk.engageTotal)} engagés` : "Aucun pari en attente"}
              action={
                <Bouton
                  variante="fantome"
                  className="min-h-9 px-2 text-[13px]"
                  onClick={async () => {
                    const n = await verifierResultats();
                    if (n === 0) notifier("Aucun nouveau résultat disponible.", "info");
                  }}
                >
                  <IcRafraichir /> Résultats
                </Bouton>
              }
            >
              Paris en cours
            </Titre>
            {enCours.length === 0 ? (
              <p className="text-[13px] text-doux">Tes paris enregistrés apparaîtront ici et seront réglés automatiquement après les matchs.</p>
            ) : (
              <ul className="space-y-2">
                {enCours.slice(0, 4).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.jambes.length > 1 ? `Combiné ${p.jambes.length} sélections` : p.jambes[0]?.label}</div>
                      <div className="truncate text-[12px] text-doux">
                        <span style={{ color: COULEUR_MODE[p.mode] }}>{NOM_MODE[p.mode]}</span> · {p.jambes.filter((j) => j.statut === "gagne").length}/{p.jambes.length} validée
                        {p.jambes.filter((j) => j.statut === "gagne").length > 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="num text-right">
                      <div className="font-semibold">{eur(p.mise)}</div>
                      <div className="text-[12px] text-doux">@ {cote(p.cote)}</div>
                    </div>
                  </li>
                ))}
                {enCours.length > 4 && (
                  <li>
                    <Link href="/suivi" className="text-[13px] font-semibold text-doux hover:text-texte">
                      + {enCours.length - 4} autre{enCours.length - 4 > 1 ? "s" : ""}
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </Carte>
        </div>
      </div>

      <Carte>
        <Titre sous="Les limites qui protègent ta bankroll, recalculées en permanence.">Garde-fous</Titre>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="mb-1 text-[12px] text-doux">Perte du jour</div>
            <Barre valeur={prot.limiteJour > 0 ? Math.max(0, -prot.pnlJour) / prot.limiteJour : 0} couleur="#f87171" />
            <div className="num mt-1 text-[12px]">
              {eur(Math.max(0, -prot.pnlJour))} / {eur(prot.limiteJour)}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[12px] text-doux">Perte sur 7 jours</div>
            <Barre valeur={prot.limiteSemaine > 0 ? Math.max(0, -prot.pnlSemaine) / prot.limiteSemaine : 0} couleur="#f87171" />
            <div className="num mt-1 text-[12px]">
              {eur(Math.max(0, -prot.pnlSemaine))} / {eur(prot.limiteSemaine)}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[12px] text-doux">Argent en jeu</div>
            <Barre valeur={prot.expositionMax > 0 ? bk.engageTotal / prot.expositionMax : 0} couleur="#fbbf24" />
            <div className="num mt-1 text-[12px]">
              {eur(bk.engageTotal)} / {eur(prot.expositionMax)}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[12px] text-doux">Bilan global</div>
            <div className="num text-[15px] font-semibold" style={{ color: stats.profit >= 0 ? "#34d399" : "#f87171" }}>
              {eurSigne(stats.profit)}
            </div>
            <div className="num text-[12px] text-doux">
              ROI {pctSigne(stats.roi)} · {stats.regles} réglé{stats.regles > 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </Carte>

    </div>
  );
}
