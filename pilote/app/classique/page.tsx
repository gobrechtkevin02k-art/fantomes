"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useCalculs, useDonnees } from "@/lib/donnees";
import { FRACTION_KELLY, LIBELLE_PROFIL, MISE_MAX_PCT, planClassique } from "@/lib/engine/mise";
import { eur, pct } from "@/lib/format";
import { emojiSport, nomSport } from "@/lib/sports";
import { CarteSelection, ModalPari, type ProjetPari } from "@/components/Paris";
import { Carte, Puces, Vide } from "@/components/ui";
import { IcBouclier, IcChevron } from "@/components/Icones";

export default function Classique() {
  const { etat } = useStore();
  const { selections, chargement, maintenant } = useDonnees();
  const { ctx, bk, prot } = useCalculs();
  const [sport, setSport] = useState("tous");
  const [projet, setProjet] = useState<ProjetPari | null>(null);
  const [methode, setMethode] = useState(false);
  const r = etat.reglages;

  const plan = useMemo(() => planClassique(selections, ctx, etat.paris, maintenant), [selections, ctx, etat.paris, maintenant]);
  const sports = useMemo(() => [...new Set(plan.map((p) => p.selection.sportKey))], [plan]);
  const liste = plan.filter((p) => sport === "tous" || p.selection.sportKey === sport);
  const jouables = liste.filter((p) => p.mise.mise > 0 && !p.horsBudget && !p.dejaJoue);
  const total = jouables.reduce((s, p) => s + p.mise.mise, 0);
  const attendu = jouables.reduce((s, p) => s + p.gainAttendu, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-classique/15 text-xl text-classique">
          <IcBouclier />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Classique</h1>
          <p className="text-[14px] text-doux">Faire grossir la bankroll sans prise de risque : uniquement des paris à valeur positive, mises calculées au centime.</p>
        </div>
      </div>

      <Carte>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-[12px] text-doux">Poche Classique</div>
            <div className="num text-[17px] font-bold text-classique">{eur(bk.poches.classique)}</div>
          </div>
          <div>
            <div className="text-[12px] text-doux">À miser</div>
            <div className="num text-[17px] font-bold">{eur(total)}</div>
            <div className="num text-[11px] text-doux">reste {eur(prot.expositionRestante)} autorisés</div>
          </div>
          <div>
            <div className="text-[12px] text-doux">Gain attendu</div>
            <div className="num text-[17px] font-bold text-positif">+{eur(attendu)}</div>
            <div className="text-[11px] text-doux">en moyenne</div>
          </div>
        </div>
        <button onClick={() => setMethode((m) => !m)} className="mt-3 flex items-center gap-1 text-[13px] font-medium text-doux hover:text-texte" aria-expanded={methode}>
          <IcChevron className={methode ? "rotate-90 transition" : "transition"} /> Comment Pilote choisit et mise
        </button>
        {methode && (
          <div className="apparait mt-3 space-y-2 border-t border-ligne pt-3 text-[13px] leading-relaxed text-doux">
            <p>
              <strong className="text-texte">1. Le juste prix.</strong> Pour chaque match, Pilote retire la marge de chaque bookmaker de référence (Pinnacle, Betfair, Betclic, Unibet…) et en
              fait une moyenne pondérée, les bookmakers les plus précis pesant plus lourd.
            </p>
            <p>
              <strong className="text-texte">2. La valeur.</strong> Si Winamax paie une issue plus cher que ce juste prix, le pari a une espérance positive : c&apos;est le seul cas où Pilote
              recommande de jouer.
            </p>
            <p>
              <strong className="text-texte">3. L&apos;indice de confiance.</strong> Il mesure la probabilité que cet avantage soit réel, compte tenu du nombre de bookmakers, de leur accord,
              du délai avant le match et du niveau de cote.
            </p>
            <p>
              <strong className="text-texte">4. La mise.</strong> Critère de Kelly (la mise qui maximise la croissance à long terme) × {FRACTION_KELLY[r.profil]} (profil{" "}
              {LIBELLE_PROFIL[r.profil].toLowerCase()}), avantage réduit selon la confiance, plafonnée à {pct(MISE_MAX_PCT[r.profil], 0)} de la bankroll par pari et{" "}
              {r.expositionMax} % engagés au total.
            </p>
          </div>
        )}
      </Carte>

      {sports.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <div className="flex w-max gap-2">
            <Puces
              label="Filtrer par compétition"
              valeur={sport}
              onChange={setSport}
              couleur="#34d399"
              options={[{ v: "tous", l: "Tout" }, ...sports.map((k) => ({ v: k, l: `${emojiSport(k)} ${nomSport(k)}` }))]}
            />
          </div>
        </div>
      )}

      {chargement && plan.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl border border-ligne bg-surface" />
          ))}
        </div>
      ) : liste.length === 0 ? (
        <Vide titre="Aucun pari Classique pour l'instant" icone={<IcBouclier />}>
          {prot.bloque
            ? prot.raisons.join(" ")
            : `Aucune cote Winamax entre ${r.classique.coteMin} et ${r.classique.coteMax} n'offre au moins ${pct(r.classique.edgeMin)} d'avantage avec un indice ≥ ${r.classique.confianceMin}. Reviens plus tard : les cotes bougent toute la journée.`}
        </Vide>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {liste.map((p) => (
            <CarteSelection key={p.selection.id} s={p.selection} mise={p.mise} mode="classique" horsBudget={p.horsBudget} dejaJoue={p.dejaJoue} onParier={setProjet} />
          ))}
        </div>
      )}

      <ModalPari projet={projet} onFermer={() => setProjet(null)} />
    </div>
  );
}
