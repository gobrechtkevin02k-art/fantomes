"use client";

// Blocs d'analyse partagés par l'onglet Résultats et les statistiques de Suivi.

import { useMemo, useState } from "react";
import type { Cloture, Mode, Mouvement, Pari } from "@/lib/types";
import { chance, clvGlobal, extremes, parCote, parIndice, parMois, parSport, plusGrosseBaisse, profitPari, series, simulerSuivi, type LigneStats } from "@/lib/engine/analyse";
import { cote, dateCourte, eur, eurSigne, pct, pctSigne } from "@/lib/format";
import Graphique from "./Graphique";
import { Carte, Champ, Puces, Stat, Titre, cx } from "./ui";

const nom = (p: Pari) => (p.jambes.length > 1 ? `Combiné à ${cote(p.cote)}` : `${p.jambes[0]?.label ?? "Pari"} à ${cote(p.cote)}`);
const couleur = (x: number) => (x > 0 ? "#34d399" : x < 0 ? "#f87171" : "#8b97a4");

/** Le meilleur et le pire, côte à côte et avec le même poids. */
export function MeilleurPire({ paris, tz, depart }: { paris: Pari[]; tz: string; depart?: number }) {
  const e = useMemo(() => extremes(paris, tz), [paris, tz]);
  const s = useMemo(() => series(paris), [paris]);
  const b = useMemo(() => plusGrosseBaisse(paris, depart), [paris, depart]);
  if (!e.meilleurPari) return null;
  const ligne = (label: string, valeur: string, detail: string | null, c: string) => (
    <div className="py-2">
      <div className="text-[12px] text-doux">{label}</div>
      <div className="num text-[16px] font-bold" style={{ color: c }}>
        {valeur}
      </div>
      {detail && <div className="truncate text-[12px] text-faible">{detail}</div>}
    </div>
  );
  return (
    <Carte>
      <Titre sous="Les pertes sont montrées avec la même place que les gains.">Le meilleur et le pire</Titre>
      <div className="grid grid-cols-2 gap-4">
        <div className="divide-y divide-ligne">
          {ligne("Meilleur pari", eurSigne(profitPari(e.meilleurPari)), nom(e.meilleurPari), couleur(profitPari(e.meilleurPari)))}
          {e.meilleurMois && ligne("Meilleur mois", eurSigne(e.meilleurMois.resultat), e.meilleurMois.libelle, couleur(e.meilleurMois.resultat))}
          {ligne("Plus longue série gagnante", `${s.gainsMax} d'affilée`, null, "#e9eef3")}
        </div>
        <div className="divide-y divide-ligne">
          {e.pirePari && ligne("Plus grosse perte", eurSigne(profitPari(e.pirePari)), nom(e.pirePari), couleur(profitPari(e.pirePari)))}
          {e.pireMois && ligne("Pire mois", eurSigne(e.pireMois.resultat), e.pireMois.libelle, couleur(e.pireMois.resultat))}
          {ligne("Plus longue série perdante", `${s.pertesMax} d'affilée`, null, "#e9eef3")}
        </div>
      </div>
      <div className="mt-2 border-t border-ligne pt-3">
        {ligne(
          "Plus grosse baisse (du plus haut au plus bas)",
          b.montant > 0 ? `${eurSigne(-b.montant)}${b.pct !== null ? ` (${pctSigne(-b.pct)})` : ""}` : "aucune",
          b.du && b.au ? `du ${dateCourte(b.du)} au ${dateCourte(b.au)}` : null,
          b.montant > 0 ? "#f87171" : "#8b97a4",
        )}
      </div>
    </Carte>
  );
}

/** Qualité des paris : cote de clôture, part de chance, calibration de l'indice. */
export function QualiteParis({ paris, clotures }: { paris: Pari[]; clotures: Record<string, Cloture> }) {
  const clv = useMemo(() => clvGlobal(paris, clotures), [paris, clotures]);
  const ch = useMemo(() => chance(paris), [paris]);
  const indices = useMemo(() => parIndice(paris), [paris]);
  return (
    <Carte>
      <Titre sous="Ce qui distingue une vraie méthode d'une bonne passe.">Qualité des paris</Titre>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-[12px] text-doux">Cote obtenue contre cote de clôture</div>
          {clv.n ? (
            <>
              <div className="num text-[22px] font-bold" style={{ color: couleur(clv.moyenne) }}>
                {pctSigne(clv.moyenne)}
              </div>
              <div className="num text-[12px] text-doux">
                en moyenne · {pct(clv.part, 0)} des {clv.n} paris ont battu la clôture
              </div>
            </>
          ) : (
            <div className="text-[13px] text-doux">La cote de clôture est relevée juste avant chaque match ; les premiers chiffres arrivent avec les prochains paris.</div>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-faible">
            Prendre une cote meilleure que le juste prix juste avant le match est le meilleur signe d&apos;une méthode qui gagne à long terme, même pendant une mauvaise série.
          </p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-[12px] text-doux">Part de chance</div>
          <div className="num text-[22px] font-bold" style={{ color: couleur(ch.ecart) }}>
            {eurSigne(ch.ecart)}
          </div>
          <div className="num text-[12px] text-doux">
            réel {eurSigne(ch.reel)} · attendu selon le modèle {eurSigne(ch.attendu)}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-faible">
            {ch.ecart >= 0 ? "Les résultats sont au-dessus de ce que valaient les paris : un peu de chance." : "Les résultats sont en dessous de ce que valaient les paris : de la malchance, qui s'efface sur la durée si la méthode est bonne."}
          </p>
        </div>
      </div>
      {indices.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[13px] font-medium">Indice annoncé contre réussite réelle</div>
          <TableStats lignes={indices} attendue />
        </div>
      )}
    </Carte>
  );
}

function TableStats({ lignes, attendue }: { lignes: LigneStats[]; attendue?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] sm:text-[12px]">
        <thead>
          <tr className="text-left text-doux">
            <th className="py-1.5 font-medium" />
            <th className="px-1 py-1.5 text-right font-medium">Paris</th>
            <th className="px-1 py-1.5 text-right font-medium">Réussite</th>
            {attendue && <th className="px-1 py-1.5 text-right font-medium">Prévue</th>}
            <th className="px-1 py-1.5 text-right font-medium">Résultat</th>
            <th className="px-1 py-1.5 text-right font-medium">ROI</th>
          </tr>
        </thead>
        <tbody className="num divide-y divide-ligne">
          {lignes.map((l) => (
            <tr key={l.cle}>
              <td className="py-2 pr-1 font-medium">{l.libelle}</td>
              <td className="px-1 py-2 text-right">{l.paris}</td>
              <td className="px-1 py-2 text-right">{pct(l.reussite, 0)}</td>
              {attendue && <td className="px-1 py-2 text-right text-doux">{pct(l.reussiteAttendue, 0)}</td>}
              <td className="px-1 py-2 text-right font-semibold" style={{ color: couleur(l.resultat) }}>
                {eurSigne(l.resultat)}
              </td>
              <td className="px-1 py-2 text-right" style={{ color: couleur(l.roi) }}>
                {pctSigne(l.roi)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Statistiques détaillées : mois par mois, par sport, par tranche de cote. */
export function StatsDetaillees({ paris, tz }: { paris: Pari[]; tz: string }) {
  const [vue, setVue] = useState<"mois" | "sport" | "cote">("mois");
  const lignes = useMemo(() => (vue === "mois" ? parMois(paris, tz) : vue === "sport" ? parSport(paris) : parCote(paris)), [vue, paris, tz]);
  if (!paris.some((p) => p.statut !== "en_cours")) return null;
  return (
    <Carte>
      <Titre>Statistiques détaillées</Titre>
      <div className="mb-3">
        <Puces
          label="Regrouper par"
          valeur={vue}
          onChange={setVue}
          options={[
            { v: "mois", l: "Mois par mois" },
            { v: "sport", l: "Par sport" },
            { v: "cote", l: "Par cote" },
          ]}
        />
      </div>
      <TableStats lignes={lignes} />
    </Carte>
  );
}

/** « Si tu avais suivi avec 100 € » : mêmes paris, même part de bankroll. */
export function Simulateur({ paris, mouvements, bankrollInitiale, dateDebut }: { paris: Pari[]; mouvements: Mouvement[]; bankrollInitiale: number; dateDebut: string }) {
  const [capital, setCapital] = useState(100);
  const [saisie, setSaisie] = useState("");
  const [modes, setModes] = useState<"classique" | "tous">("classique");
  const sim = useMemo(
    () => simulerSuivi({ paris, mouvements, bankrollInitiale, dateDebut, capital, modes: (modes === "classique" ? ["classique"] : ["classique", "objectif", "jackpot"]) as Mode[] }),
    [paris, mouvements, bankrollInitiale, dateDebut, capital, modes],
  );
  return (
    <Carte accent="#a78bfa">
      <Titre sous="Les mêmes paris, en misant la même part de ta bankroll que le compte suivi.">Si tu avais suivi</Titre>
      <div className="flex flex-wrap items-end gap-2">
        <Puces
          label="Capital de départ"
          valeur={saisie ? -1 : capital}
          onChange={(v) => {
            setSaisie("");
            setCapital(v);
          }}
          couleur="#a78bfa"
          options={[50, 100, 500].map((v) => ({ v, l: `${v} €` }))}
        />
        <Champ
          className="w-32"
          label="Autre montant"
          inputMode="decimal"
          value={saisie}
          suffixe="€"
          onChange={(e) => {
            setSaisie(e.target.value);
            const v = Number(e.target.value.replace(",", "."));
            if (v > 0 && v < 1e7) setCapital(v);
          }}
        />
      </div>
      <div className="mt-3">
        <Puces
          label="Paris suivis"
          valeur={modes}
          onChange={setModes}
          options={[
            { v: "classique", l: "Mode Classique" },
            { v: "tous", l: "Tous les paris" },
          ]}
        />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label="Tu aurais" valeur={eur(sim.final)} grand couleur={couleur(sim.profit)} />
        <Stat label="Résultat" valeur={eurSigne(sim.profit)} couleur={couleur(sim.profit)} sous={pctSigne(sim.roi)} />
        <Stat label="Paris suivis" valeur={String(sim.paris)} />
      </div>
      {sim.courbe.length > 1 && (
        <div className="mt-3">
          <Graphique points={sim.courbe} depart={capital} hauteur={110} />
        </div>
      )}
      <p className={cx("mt-2 text-[11px] leading-relaxed text-faible")}>Simulation à partir des paris réels du compte. Les résultats passés ne préjugent pas des résultats futurs.</p>
    </Carte>
  );
}
