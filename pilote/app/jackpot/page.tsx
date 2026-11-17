"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useCalculs, useDonnees } from "@/lib/donnees";
import { PageVerrouillee } from "@/components/Offres";
import { combosJackpot, simplesJackpot } from "@/lib/engine/modes";
import { miseJackpot } from "@/lib/engine/mise";
import { cote, dateMatch, eur, pctSigne } from "@/lib/format";
import { emojiSport } from "@/lib/sports";
import { CarteCombo, ModalPari, type ProjetPari } from "@/components/Paris";
import { lienWinamax } from "@/lib/winamax";
import { Bouton, Carte, Jauge, Puces, Titre, Vide } from "@/components/ui";
import { IcAlerte, IcDiamant, IcExterne, IcInfo } from "@/components/Icones";

const CIBLES = [50, 100, 250, 500, 1000];
const SIMPLES = [10, 20, 50];

export default function Jackpot() {
  const { etat, majReglages } = useStore();
  const { selections, chargement, maintenant, droits } = useDonnees();
  const { ctx, bk } = useCalculs();
  const j = etat.reglages.jackpot;
  const [projet, setProjet] = useState<ProjetPari | null>(null);
  const regler = (p: Partial<typeof j>) => majReglages({ jackpot: { ...j, ...p } });

  const combos = useMemo(() => combosJackpot(selections, etat.reglages, maintenant), [selections, etat.reglages, maintenant]);
  const simples = useMemo(() => simplesJackpot(selections, etat.reglages, maintenant), [selections, etat.reglages, maintenant]);

  if (!droits.jackpot) {
    return (
      <PageVerrouillee test={(d) => d.jackpot} titre="Jackpot" icone={<IcDiamant />}>
        De toutes petites mises sur de très grosses cotes, pour rêver sans mettre ta bankroll en danger. Mode fun à haut risque, sans accompagnement du conseiller.
      </PageVerrouillee>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-jackpot/15 text-xl text-jackpot">
          <IcDiamant />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Jackpot</h1>
          <p className="text-[14px] text-doux">Des miettes de mise sur de très grosses cotes. Pour rêver, sans jamais mettre ta bankroll en danger.</p>
        </div>
      </div>

      <div className="flex gap-2 rounded-2xl border border-negatif/30 bg-negatif/10 p-3 text-[12px] leading-relaxed text-negatif">
        <IcAlerte className="mt-0.5 shrink-0 text-sm" />
        <p>
          <strong>Mode à haut risque, hors accompagnement.</strong> Le conseiller ne gère pas ces paris : pas de plan, pas de mise relevée, pas de suivi en temps réel ni de
          notification. Ils restent limités à leur petite poche pour ne jamais toucher ta bankroll sérieuse.
        </p>
      </div>

      <Carte accent="#fbbf24">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[12px] text-doux">Poche Jackpot</div>
            <div className="num text-[17px] font-bold text-jackpot">{eur(bk.poches.jackpot)}</div>
          </div>
          <div>
            <div className="text-[12px] text-doux">Mise type</div>
            <div className="num text-[17px] font-bold">{eur(miseJackpot(50, ctx).mise)}</div>
            <div className="text-[11px] text-doux">max 0,5 % de la bankroll</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-2 text-[13px] font-medium text-doux">Cote visée pour les combinés</div>
          <Puces label="Cote visée" valeur={j.cibleCombo} onChange={(v) => regler({ cibleCombo: v })} couleur="#fbbf24" options={CIBLES.map((c) => ({ v: c, l: `${c}` }))} />
        </div>
      </Carte>

      <section className="space-y-3">
        <Titre sous="Construits uniquement avec des sélections que Winamax paie au-dessus du juste prix.">Combinés jackpot</Titre>
        {chargement && combos.length === 0 ? (
          <div className="h-64 animate-pulse rounded-2xl border border-ligne bg-surface" />
        ) : combos.length === 0 ? (
          <Vide titre={`Pas assez de sélections à valeur positive pour viser ${j.cibleCombo}`} icone={<IcDiamant />}>
            Baisse la cote visée ou reviens après l&apos;actualisation des cotes.
          </Vide>
        ) : (
          combos.map((c) => <CarteCombo key={c.jambes.map((x) => x.id).join("~")} c={c} mise={miseJackpot(c.confiance, ctx)} mode="jackpot" onParier={setProjet} />)
        )}
      </section>

      <section className="space-y-3">
        <div>
          <Titre sous="Les outsiders les mieux payés par rapport au marché.">Grosses cotes simples</Titre>
          <Puces label="Cote minimum" valeur={j.coteMin} onChange={(v) => regler({ coteMin: v })} couleur="#fbbf24" options={SIMPLES.map((c) => ({ v: c, l: `cote ${c}+` }))} />
        </div>
        {simples.length === 0 ? (
          <Vide titre={`Aucune cote ≥ ${j.coteMin} disponible`}>Les grosses cotes simples se trouvent surtout sur les matchs très déséquilibrés.</Vide>
        ) : (
          <Carte className="!p-0">
            <ul className="divide-y divide-ligne">
              {simples.map((s) => {
                const m = miseJackpot(s.confidence, ctx);
                return (
                  <li key={s.id} className="flex items-center gap-3 p-3 sm:p-4">
                    <Jauge valeur={s.confidence} taille={40} epaisseur={4} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold">{s.label}</div>
                      <div className="truncate text-[12px] text-doux">
                        {emojiSport(s.sportKey)} {s.home} – {s.away} · {dateMatch(s.commence, maintenant)}
                      </div>
                      <div className="num text-[12px]">
                        <span className="font-bold text-jackpot">@ {cote(s.odds)}</span>
                        <span className="text-doux"> · juste {cote(s.fairOdds)} · </span>
                        <span style={{ color: s.edge >= 0 ? "#34d399" : "#f87171" }}>{pctSigne(s.edge)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <a href={lienWinamax(s.link)} target="_blank" rel="noopener noreferrer" className="text-[12px] text-doux hover:text-texte" aria-label="Ouvrir Winamax">
                        <IcExterne />
                      </a>
                      <Bouton
                        className="min-h-9 px-3 text-[13px]"
                        couleur="#fbbf24"
                        disabled={m.bloque}
                        onClick={() => setProjet({ mode: "jackpot", titre: "Jackpot", jambes: [s], cote: s.odds, mise: m.mise || ctx.reglages.miseMin, confiance: s.confidence, edge: s.edge, proba: s.fairProb })}
                      >
                        {m.mise > 0 ? eur(m.mise) : "Parier"}
                      </Bouton>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Carte>
        )}
      </section>

      <div className="flex gap-2 rounded-2xl border border-ligne p-3.5 text-[12px] leading-relaxed text-doux">
        <IcInfo className="mt-0.5 shrink-0 text-sm" />
        <p>
          À savoir : les bookmakers prennent leur plus grosse marge sur les outsiders, donc une grosse cote simple est presque toujours mal payée (espérance en rouge). C&apos;est pour ça que
          Pilote construit tes grosses cotes en combinant des sélections à valeur positive. Mise de {j.misePct} % de la poche modulée par l&apos;indice, jamais plus de 0,5 % de la bankroll.
        </p>
      </div>

      <ModalPari projet={projet} onFermer={() => setProjet(null)} />
    </div>
  );
}
