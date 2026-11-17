"use client";

import { useMemo, useState } from "react";
import type { Mode, Pari, StatutPari, TypeMouvement } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useCalculs, useDonnees } from "@/lib/donnees";
import { MODES, statistiques, type Stats } from "@/lib/engine/bankroll";
import { cote, dateCourte, dateMatch, eur, eurSigne, pct, pctSigne, uid } from "@/lib/format";
import { emojiSport } from "@/lib/sports";
import Graphique from "@/components/Graphique";
import { Badge, Bouton, COULEUR_MODE, Carte, Champ, Modal, NOM_MODE, Puces, Stat, Titre, Vide, cx } from "@/components/ui";
import { IcGraphique, IcPoubelle, IcRafraichir } from "@/components/Icones";

const STATUT: Record<StatutPari, { l: string; c: string }> = {
  en_cours: { l: "En cours", c: "#8b97a4" },
  gagne: { l: "Gagné", c: "#34d399" },
  perdu: { l: "Perdu", c: "#f87171" },
  rembourse: { l: "Remboursé", c: "#8b97a4" },
  cashout: { l: "Cash-out", c: "#fbbf24" },
};

function LignePari({ p, onRegler }: { p: Pari; onRegler: (p: Pari) => void }) {
  const { supprimerPari, majParis } = useStore();
  const publicCompte = !!useDonnees().abonnement.public;
  const st = STATUT[p.statut];
  const profit = (p.gain ?? 0) - p.mise;
  return (
    <Carte className="!p-4" accent={COULEUR_MODE[p.mode]}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge couleur={COULEUR_MODE[p.mode]}>{NOM_MODE[p.mode]}</Badge>
          <Badge couleur={st.c}>{st.l}</Badge>
          {p.demo && <Badge couleur="#fbbf24">Démo</Badge>}
          {p.auto && <span className="text-[11px] text-faible">réglé automatiquement</span>}
        </div>
        <span className="num shrink-0 text-[12px] text-faible">{dateCourte(p.creeLe)}</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {p.jambes.map((j) => (
          <li key={j.selectionId} className="flex items-center justify-between gap-3 text-[13px]">
            <div className="min-w-0">
              <div className="truncate font-medium">
                <span className="mr-1.5 inline-block size-1.5 rounded-full align-middle" style={{ background: STATUT[j.statut === "en_cours" ? "en_cours" : j.statut].c }} />
                {j.label}
              </div>
              <div className="truncate text-[12px] text-doux">
                {emojiSport(j.sportKey)} {j.home} – {j.away} · {dateMatch(j.commence)}
              </div>
            </div>
            <span className="num shrink-0 text-doux">{cote(j.odds)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-ligne pt-3">
        <div className="num text-[13px]">
          <span className="text-doux">Mise</span> <span className="font-semibold">{eur(p.mise)}</span>
          <span className="text-doux"> @ </span>
          <span className="font-semibold">{cote(p.cote)}</span>
          <span className="text-doux"> · indice {Math.round(p.confiance)}</span>
        </div>
        {p.statut === "en_cours" ? (
          <div className="num text-[13px] text-doux">
            Gain possible <span className="font-semibold text-texte">{eur(p.mise * p.cote)}</span>
          </div>
        ) : (
          <div className="num text-[15px] font-bold" style={{ color: profit > 0 ? "#34d399" : profit < 0 ? "#f87171" : "#8b97a4" }}>
            {eurSigne(profit)}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {p.statut === "en_cours" ? (
          <Bouton variante="contour" className="min-h-9 text-[13px]" onClick={() => onRegler(p)}>
            Régler à la main
          </Bouton>
        ) : (
          <Bouton
            variante="fantome"
            className="min-h-9 text-[13px]"
            onClick={() => majParis([{ ...p, statut: "en_cours", gain: undefined, regleLe: undefined, auto: undefined, jambes: p.jambes.map((j) => ({ ...j, statut: "en_cours" })) }])}
          >
            Annuler le règlement
          </Bouton>
        )}
        <Bouton
          variante="fantome"
          className="ml-auto min-h-9 text-[13px]"
          onClick={() => {
            if (confirm(publicCompte ? "Supprimer ce pari ? La suppression sera visible dans le journal public des Résultats." : "Supprimer ce pari de l'historique ?")) supprimerPari(p.id);
          }}
          aria-label="Supprimer le pari"
        >
          <IcPoubelle />
        </Bouton>
      </div>
    </Carte>
  );
}

function ModalReglement({ p, onFermer }: { p: Pari | null; onFermer: () => void }) {
  const { majParis } = useStore();
  const [montant, setMontant] = useState("");
  if (!p) return null;
  const regler = (statut: StatutPari, gain: number) => {
    majParis([
      {
        ...p,
        statut,
        gain: Math.round(gain * 100) / 100,
        regleLe: new Date().toISOString(),
        auto: false,
        jambes: p.jambes.map((j) => ({ ...j, statut: statut === "gagne" ? "gagne" : statut === "rembourse" ? "rembourse" : j.statut })),
      },
    ]);
    setMontant("");
    onFermer();
  };
  const m = Number(montant.replace(",", "."));
  return (
    <Modal ouvert onFermer={onFermer} titre="Régler le pari">
      <p className="mb-4 text-[14px] text-doux">
        {eur(p.mise)} à {cote(p.cote)} · {p.jambes.length > 1 ? `combiné de ${p.jambes.length} sélections` : p.jambes[0]?.label}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Bouton couleur="#34d399" onClick={() => regler("gagne", p.mise * p.cote)}>
          Gagné · {eur(p.mise * p.cote)}
        </Bouton>
        <Bouton variante="danger" onClick={() => regler("perdu", 0)}>
          Perdu
        </Bouton>
        <Bouton variante="contour" className="col-span-2" onClick={() => regler("rembourse", p.mise)}>
          Remboursé · {eur(p.mise)}
        </Bouton>
      </div>
      <div className="mt-4 flex items-end gap-2 border-t border-ligne pt-4">
        <Champ className="flex-1" label="Cash-out : montant encaissé" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} suffixe="€" />
        <Bouton couleur="#fbbf24" disabled={!(m >= 0 && montant !== "")} onClick={() => regler("cashout", m)}>
          Valider
        </Bouton>
      </div>
    </Modal>
  );
}

function BlocStats({ s, titre, couleur }: { s: Stats; titre: string; couleur: string }) {
  return (
    <Carte accent={couleur}>
      <Titre sous={`${s.nb} pari${s.nb > 1 ? "s" : ""} · ${s.enCours} en cours`}>{titre}</Titre>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Bénéfice" valeur={eurSigne(s.profit)} couleur={s.profit >= 0 ? "#34d399" : "#f87171"} />
        <Stat label="ROI" valeur={pctSigne(s.roi)} couleur={s.roi >= 0 ? "#34d399" : "#f87171"} sous={`sur ${eur(s.misesReglees, 0)} misés`} />
        <Stat label="Réussite" valeur={pct(s.tauxReussite, 0)} sous={`${s.gagnes} G · ${s.perdus} P${s.rembourses ? ` · ${s.rembourses} R` : ""}`} />
        <Stat label="Cote moyenne" valeur={s.coteMoyenne ? cote(s.coteMoyenne) : "—"} sous={`indice moyen ${Math.round(s.confianceMoyenne)}`} />
      </div>
      {s.regles >= 5 && (
        <p className="mt-3 text-[12px] text-doux">
          Selon le modèle, ces paris valaient <span className="num font-semibold text-texte">{eurSigne(s.profitAttendu)}</span> en moyenne. Écart avec le réel :{" "}
          <span className="num font-semibold" style={{ color: s.profit - s.profitAttendu >= 0 ? "#34d399" : "#f87171" }}>
            {eurSigne(s.profit - s.profitAttendu)}
          </span>{" "}
          ({s.profit >= s.profitAttendu ? "un peu de chance" : "pas de chance"} : sur quelques dizaines de paris, c&apos;est normal).
        </p>
      )}
    </Carte>
  );
}

function Mouvements() {
  const { etat, ajouterMouvement, supprimerMouvement } = useStore();
  const { bk } = useCalculs();
  const { notifier, abonnement } = useDonnees();
  const [type, setType] = useState<"depot" | "retrait" | "synchro">("depot");
  const [montant, setMontant] = useState("");
  const m = Number(montant.replace(",", "."));

  const valider = () => {
    if (!(m >= 0) || montant === "") return;
    if (type === "synchro") {
      // Le solde Winamax n'inclut pas les mises en cours : on compare au disponible.
      const ecart = Math.round((m - bk.disponible) * 100) / 100;
      if (ecart === 0) notifier("Déjà synchronisé : rien à corriger.", "info");
      else {
        ajouterMouvement({ id: uid(), date: new Date().toISOString(), type: "ajustement", montant: ecart, note: `Synchronisation avec le solde Winamax (${eur(m)})` });
        notifier(`Bankroll corrigée de ${eurSigne(ecart)}.`, "succes");
      }
    } else {
      ajouterMouvement({ id: uid(), date: new Date().toISOString(), type, montant: type === "retrait" ? -m : m });
      notifier(type === "depot" ? `Dépôt de ${eur(m)} ajouté.` : `Retrait de ${eur(m)} enregistré.`, "succes");
    }
    setMontant("");
  };

  const NOMS: Record<TypeMouvement, string> = { depot: "Dépôt", retrait: "Retrait", ajustement: "Ajustement", reequilibrage: "Rééquilibrage des poches" };
  return (
    <div className="space-y-4">
      <Carte>
        <Titre sous="Garde Pilote aligné sur ton vrai compte Winamax.">Dépôts, retraits et synchronisation</Titre>
        {abonnement.public && (
          <p className="mb-3 rounded-xl bg-jackpot/10 p-3 text-[12px] text-jackpot">
            Compte public : chaque dépôt, retrait et correction apparaît dans l&apos;onglet Résultats, visible par tes abonnés.
          </p>
        )}
        <Puces
          label="Type d'opération"
          valeur={type}
          onChange={setType}
          options={[
            { v: "depot", l: "Dépôt" },
            { v: "retrait", l: "Retrait" },
            { v: "synchro", l: "Synchroniser mon solde" },
          ]}
        />
        <div className="mt-3 flex items-end gap-2">
          <Champ
            className="flex-1"
            label={type === "synchro" ? "Solde affiché sur Winamax" : "Montant"}
            inputMode="decimal"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            suffixe="€"
            aide={type === "synchro" ? `Pilote calcule ${eur(bk.disponible)} disponibles (hors mises en cours). L'écart sera réparti entre les poches.` : undefined}
          />
          <Bouton onClick={valider} disabled={montant === "" || !(m >= 0)}>
            Valider
          </Bouton>
        </div>
      </Carte>
      <Carte>
        <Titre sous="Remet chaque poche à sa part cible de la bankroll totale.">Poches</Titre>
        <div className="grid grid-cols-3 gap-3">
          {MODES.map((mo) => (
            <Stat key={mo} label={NOM_MODE[mo]} valeur={eur(bk.poches[mo])} couleur={COULEUR_MODE[mo]} sous={`cible ${etat.reglages.allocation[mo]} %`} />
          ))}
        </div>
        <Bouton
          variante="contour"
          className="mt-4 w-full"
          onClick={() => {
            ajouterMouvement({ id: uid(), date: new Date().toISOString(), type: "reequilibrage", montant: 0 });
            notifier("Poches rééquilibrées.", "succes");
          }}
        >
          Rééquilibrer les poches
        </Bouton>
      </Carte>
      {etat.mouvements.length > 0 && (
        <Carte className="!p-0">
          <ul className="divide-y divide-ligne">
            {[...etat.mouvements].reverse().map((mv) => (
              <li key={mv.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[14px]">
                <div className="min-w-0">
                  <div className="font-medium">{NOMS[mv.type]}</div>
                  <div className="truncate text-[12px] text-doux">
                    {dateCourte(mv.date)}
                    {mv.note ? ` · ${mv.note}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {mv.type !== "reequilibrage" && (
                    <span className="num font-semibold" style={{ color: mv.montant >= 0 ? "#34d399" : "#f87171" }}>
                      {eurSigne(mv.montant)}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (!abonnement.public || confirm("Supprimer cette opération ? La suppression sera visible dans le journal public des Résultats.")) supprimerMouvement(mv.id);
                    }}
                    className="grid size-8 place-items-center rounded-full text-faible hover:bg-surface-2 hover:text-texte" aria-label="Supprimer l'opération">
                    <IcPoubelle />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </div>
  );
}

type Onglet = "en_cours" | "historique" | "stats" | "mouvements";

export default function Suivi() {
  const { etat } = useStore();
  const { bk } = useCalculs();
  const { verifierResultats, notifier, maintenant } = useDonnees();
  const [onglet, setOnglet] = useState<Onglet>("en_cours");
  const [aRegler, setARegler] = useState<Pari | null>(null);
  const [filtre, setFiltre] = useState<Mode | "tous">("tous");

  const enCours = etat.paris.filter((p) => p.statut === "en_cours" && (filtre === "tous" || p.mode === filtre));
  const regles = etat.paris
    .filter((p) => p.statut !== "en_cours" && (filtre === "tous" || p.mode === filtre))
    .sort((a, b) => Date.parse(b.regleLe ?? b.creeLe) - Date.parse(a.regleLe ?? a.creeLe));
  const global = useMemo(() => statistiques(etat.paris), [etat.paris]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Suivi</h1>
          <p className="text-[14px] text-doux">Historique, statistiques et synchronisation avec Winamax.</p>
        </div>
        <Bouton
          variante="contour"
          className="min-h-10 text-[13px]"
          onClick={async () => {
            const n = await verifierResultats();
            if (n === 0) notifier("Aucun nouveau résultat disponible.", "info");
          }}
        >
          <IcRafraichir /> Résultats
        </Bouton>
      </div>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1 rounded-2xl border border-ligne bg-surface p-1">
          {(
            [
              ["en_cours", `En cours (${etat.paris.filter((p) => p.statut === "en_cours").length})`],
              ["historique", "Historique"],
              ["stats", "Statistiques"],
              ["mouvements", "Dépôts & solde"],
            ] as [Onglet, string][]
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setOnglet(v)}
              className={cx("min-h-9 rounded-xl px-3.5 text-[13px] font-semibold transition", onglet === v ? "bg-surface-3 text-texte" : "text-doux hover:text-texte")}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {(onglet === "en_cours" || onglet === "historique") && (
        <Puces
          label="Filtrer par mode"
          valeur={filtre}
          onChange={setFiltre}
          options={[{ v: "tous", l: "Tous" }, ...MODES.map((m) => ({ v: m, l: NOM_MODE[m] }))]}
        />
      )}

      {onglet === "en_cours" &&
        (enCours.length === 0 ? (
          <Vide titre="Aucun pari en cours" icone={<IcGraphique />}>
            Quand tu valides « J&apos;ai parié », le pari arrive ici. Il est réglé automatiquement après le match (1N2, plus/moins, handicap).
          </Vide>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {enCours.map((p) => (
              <LignePari key={p.id} p={p} onRegler={setARegler} />
            ))}
          </div>
        ))}

      {onglet === "historique" &&
        (regles.length === 0 ? (
          <Vide titre="Pas encore de pari réglé" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {regles.map((p) => (
              <LignePari key={p.id} p={p} onRegler={setARegler} />
            ))}
          </div>
        ))}

      {onglet === "stats" && (
        <div className="space-y-4">
          <Carte>
            <Titre sous={`Plus haut ${eur(bk.pic)} · baisse actuelle ${pct(bk.drawdown, 0)}`}>Évolution de la bankroll</Titre>
            <Graphique points={[...bk.historique, { date: new Date(maintenant).toISOString(), total: bk.total }]} depart={bk.apports} objectif={etat.reglages.objectif?.montant} hauteur={180} />
          </Carte>
          <BlocStats s={global} titre="Tous les paris" couleur="#e9eef3" />
          {MODES.map((m) => (
            <BlocStats key={m} s={statistiques(etat.paris, m)} titre={NOM_MODE[m]} couleur={COULEUR_MODE[m]} />
          ))}
          {global.serie.type && global.serie.longueur >= 3 && (
            <p className="text-center text-[13px] text-doux">
              Série en cours : {global.serie.longueur} paris {global.serie.type === "gagne" ? "gagnés" : "perdus"} d&apos;affilée.{" "}
              {global.serie.type === "perdu" ? "Ça arrive même avec un avantage réel : ne change rien, ne cherche pas à te refaire." : "Profite, mais ne gonfle pas les mises."}
            </p>
          )}
        </div>
      )}

      {onglet === "mouvements" && <Mouvements />}

      <ModalReglement p={aRegler} onFermer={() => setARegler(null)} />
    </div>
  );
}
