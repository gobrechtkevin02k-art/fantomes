"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useCalculs, useDonnees } from "@/lib/donnees";
import { PageVerrouillee } from "@/components/Offres";
import { combosObjectif } from "@/lib/engine/modes";
import { miseObjectif } from "@/lib/engine/mise";
import { cote, eur } from "@/lib/format";
import { CarteCombo, ModalPari, type ProjetPari } from "@/components/Paris";
import { Carte, Champ, Puces, Vide } from "@/components/ui";
import { IcAlerte, IcCible, IcInfo } from "@/components/Icones";

const CIBLES = [2, 3, 5, 10, 20, 50];
const HORIZONS = [
  { v: 1, l: "24 h" },
  { v: 3, l: "3 jours" },
  { v: 7, l: "1 semaine" },
  { v: 14, l: "2 semaines" },
  { v: 21, l: "3 semaines" },
];
const JAMBES = [3, 5, 8, 12];

export default function Objectif() {
  const { etat, majReglages } = useStore();
  const { selections, chargement, maintenant, droits } = useDonnees();
  const { ctx, bk, prot } = useCalculs();
  const o = etat.reglages.objectifCote;
  const [saisie, setSaisie] = useState(CIBLES.includes(o.cible) ? "" : String(o.cible));
  const [projet, setProjet] = useState<ProjetPari | null>(null);

  const regler = (p: Partial<typeof o>) => majReglages({ objectifCote: { ...o, ...p } });
  const params = useDeferredValue(o);

  const props = useMemo(
    () => (params.cible > 1 ? combosObjectif(selections, etat.reglages, params.cible, params.horizonJours, params.jambesMax, maintenant) : []),
    [selections, etat.reglages, params.cible, params.horizonJours, params.jambesMax, maintenant],
  );

  if (!droits.objectifCote) {
    return (
      <PageVerrouillee test={(d) => d.objectifCote} titre="Objectif cote" icone={<IcCible />}>
        Tu fixes une cote minimum, Pilote cherche le combiné qui a le plus de chances de passer. Mode fun à haut risque, sans accompagnement du conseiller.
      </PageVerrouillee>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-objectif/15 text-xl text-objectif">
          <IcCible />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Objectif cote</h1>
          <p className="text-[14px] text-doux">Tu fixes la cote minimum, Pilote cherche parmi tous les matchs à venir le combiné qui a le plus de chances de passer.</p>
        </div>
      </div>

      <div className="flex gap-2 rounded-2xl border border-negatif/30 bg-negatif/10 p-3 text-[12px] leading-relaxed text-negatif">
        <IcAlerte className="mt-0.5 shrink-0 text-sm" />
        <p>
          <strong>Mode à haut risque, hors accompagnement.</strong> Le conseiller ne gère pas ces paris : pas de plan, pas de mise relevée, pas de suivi en temps réel ni de
          notification. Ils restent limités à leur petite poche pour ne jamais toucher ta bankroll sérieuse.
        </p>
      </div>

      <Carte accent="#a78bfa">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-[13px] font-medium text-doux">Cote minimum</div>
            <Puces
              label="Cote minimum"
              valeur={CIBLES.includes(o.cible) && !saisie ? o.cible : -1}
              onChange={(v) => {
                setSaisie("");
                regler({ cible: v });
              }}
              couleur="#a78bfa"
              options={CIBLES.map((c) => ({ v: c, l: `${c}` }))}
            />
            <Champ
              className="mt-2 max-w-48"
              label="Ou une cote précise"
              inputMode="decimal"
              placeholder="ex. 7,5"
              value={saisie}
              onChange={(e) => {
                setSaisie(e.target.value);
                const v = Number(e.target.value.replace(",", "."));
                if (v > 1 && v <= 100000) regler({ cible: v });
              }}
            />
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium text-doux">Matchs joués d&apos;ici</div>
            <Puces label="Horizon" valeur={o.horizonJours} onChange={(v) => regler({ horizonJours: v })} couleur="#a78bfa" options={HORIZONS} />
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium text-doux">Nombre de sélections maximum</div>
            <Puces label="Sélections maximum" valeur={o.jambesMax} onChange={(v) => regler({ jambesMax: v })} couleur="#a78bfa" options={JAMBES.map((j) => ({ v: j, l: `${j}` }))} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">
          <span className="text-doux">Poche Objectif</span>
          <span className="num font-semibold text-objectif">{eur(bk.poches.objectif)}</span>
        </div>
      </Carte>

      {chargement && props.length === 0 ? (
        <div className="h-64 animate-pulse rounded-2xl border border-ligne bg-surface" />
      ) : props.length === 0 ? (
        <Vide titre={`Pas de combiné à ${cote(o.cible)} avec ces critères`} icone={<IcCible />}>
          Allonge l&apos;horizon, autorise plus de sélections ou ajoute des compétitions dans les réglages.
        </Vide>
      ) : (
        <div className="space-y-3">
          {props.map((c) => (
            <CarteCombo key={c.jambes.map((j) => j.id).join("~")} c={c} mise={miseObjectif(c.confiance, ctx)} mode="objectif" onParier={setProjet} />
          ))}
        </div>
      )}

      <div className="flex gap-2 rounded-2xl border border-ligne p-3.5 text-[12px] leading-relaxed text-doux">
        <IcInfo className="mt-0.5 shrink-0 text-sm" />
        <p>
          Chaque sélection vient d&apos;un match différent (pas de corrélation cachée). Les chances affichées viennent du consensus des bookmakers, l&apos;indice mesure la probabilité que le
          combiné soit réellement mieux payé qu&apos;il ne devrait. Un combiné multiplie les marges : plus il est long, plus il est risqué. La mise suit l&apos;indice, de 1 % à 5 % de la poche,
          jamais plus de 2 % de ta bankroll{prot.prudence ? " (divisée par deux en mode prudence)" : ""}.
        </p>
      </div>

      <ModalPari projet={projet} onFermer={() => setProjet(null)} />
    </div>
  );
}
