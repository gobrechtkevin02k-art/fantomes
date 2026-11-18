"use client";

// Premier lancement : bankroll, objectif, profil de risque et répartition des poches.

import { useState } from "react";
import type { Mode, Profil } from "@/lib/types";
import { useStore } from "@/lib/store";
import { eur, pct } from "@/lib/format";
import { FRACTION_KELLY, MISE_MAX_PCT } from "@/lib/engine/mise";
import { Bouton, Champ, Interrupteur, cx } from "./ui";
import { IcBouclier, IcCible, IcDiamant, Logo } from "./Icones";

const PROFILS: { v: Profil; titre: string; texte: string }[] = [
  { v: "prudent", titre: "Prudent", texte: "Croissance lente, très peu de variance." },
  { v: "equilibre", titre: "Équilibré", texte: "Le meilleur compromis croissance / sécurité." },
  { v: "offensif", titre: "Offensif", texte: "Mises plus fortes, la bankroll varie davantage." },
];

const REPARTITIONS: { nom: string; a: Record<Mode, number> }[] = [
  { nom: "Sérieux", a: { classique: 90, objectif: 8, jackpot: 2 } },
  { nom: "Équilibré", a: { classique: 80, objectif: 15, jackpot: 5 } },
  { nom: "Fun", a: { classique: 65, objectif: 25, jackpot: 10 } },
];

export default function Onboarding() {
  const { etat, terminerOnboarding } = useStore();
  const r = etat.reglages;
  const [bankroll, setBankroll] = useState(String(r.bankrollInitiale));
  const [avecObjectif, setAvecObjectif] = useState(true);
  const [objectif, setObjectif] = useState(String(r.objectif?.montant ?? 200));
  const [dateObj, setDateObj] = useState(r.objectif?.date ?? "");
  const [profil, setProfil] = useState<Profil>(r.profil);
  const [rep, setRep] = useState(1);
  const [compris, setCompris] = useState(false);

  const b = Number(bankroll.replace(",", "."));
  const o = Number(objectif.replace(",", "."));
  const valide = b > 0 && compris && (!avecObjectif || (o > b && !!dateObj));
  const alloc = REPARTITIONS[rep].a;

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] sm:pt-14 sm:pb-14">
      <div className="flex items-center gap-3">
        <Logo className="size-11" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pilote</h1>
          <p className="text-[14px] text-doux">Ta bankroll en pilote automatique.</p>
        </div>
      </div>

      <p className="mt-6 text-[15px] leading-relaxed text-doux">
        Pilote compare chaque cote Winamax au juste prix du marché, calcule un indice de confiance et fixe seul la mise idéale selon ta bankroll. Deux minutes de réglages
        et c&apos;est parti.
      </p>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-faible">1 · Ta bankroll</h2>
          <Champ
            label="Somme que tu consacres aux paris"
            inputMode="decimal"
            value={bankroll}
            onChange={(e) => setBankroll(e.target.value)}
            suffixe="€"
            aide="Idéalement ton solde Winamax actuel. Uniquement de l'argent que tu peux te permettre de perdre."
          />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-faible">2 · Ton objectif</h2>
            <Interrupteur actif={avecObjectif} onChange={setAvecObjectif} label="Définir un objectif" />
          </div>
          {avecObjectif ? (
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Atteindre" inputMode="decimal" value={objectif} onChange={(e) => setObjectif(e.target.value)} suffixe="€" />
              <Champ label="Avant le" type="date" value={dateObj} onChange={(e) => setDateObj(e.target.value)} />
              {o > 0 && b > 0 && o <= b && <p className="col-span-2 text-[12px] text-negatif">L&apos;objectif doit dépasser ta bankroll de départ.</p>}
            </div>
          ) : (
            <p className="text-[14px] text-doux">Pas d&apos;objectif chiffré : Pilote fera simplement croître ta bankroll au rythme le plus sain.</p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-faible">3 · Ton profil de risque</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {PROFILS.map((p) => (
              <button
                key={p.v}
                type="button"
                onClick={() => setProfil(p.v)}
                className={cx("rounded-2xl border p-3 text-left transition", profil === p.v ? "border-texte bg-surface-2" : "border-ligne bg-surface hover:bg-surface-2")}
                aria-pressed={profil === p.v}
              >
                <div className="font-semibold">{p.titre}</div>
                <div className="mt-0.5 text-[12px] text-doux">{p.texte}</div>
                <div className="num mt-2 text-[11px] text-faible">
                  Kelly × {FRACTION_KELLY[p.v]} · max {pct(MISE_MAX_PCT[p.v], 0)}/pari
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wider text-faible">4 · Tes trois poches</h2>
          <p className="mb-3 text-[13px] text-doux">Chaque gamme mise uniquement dans sa poche : le fun ne peut jamais manger ta bankroll sérieuse.</p>
          <div className="mb-3 flex gap-2">
            {REPARTITIONS.map((x, i) => (
              <button
                key={x.nom}
                type="button"
                onClick={() => setRep(i)}
                className={cx("min-h-10 flex-1 rounded-xl border text-[14px] font-semibold", rep === i ? "border-texte bg-texte text-fond" : "border-ligne bg-surface-2")}
              >
                {x.nom}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {(
              [
                ["classique", "Classique", "Faire grossir la bankroll sans prise de risque", IcBouclier, "#34d399"],
                ["objectif", "Objectif cote", "Tu choisis une cote minimum, Pilote trouve le meilleur combiné", IcCible, "#a78bfa"],
                ["jackpot", "Jackpot", "Toutes petites mises sur de très grosses cotes", IcDiamant, "#fbbf24"],
              ] as const
            ).map(([m, nom, texte, Icone, c]) => (
              <div key={m} className="flex items-center gap-3 rounded-2xl border border-ligne bg-surface p-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `${c}1a`, color: c }}>
                  <Icone className="text-xl" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{nom}</div>
                  <div className="text-[12px] text-doux">{texte}</div>
                </div>
                <div className="text-right">
                  <div className="num font-bold" style={{ color: c }}>
                    {alloc[m]} %
                  </div>
                  <div className="num text-[11px] text-doux">{b > 0 ? eur((b * alloc[m]) / 100) : "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-ligne bg-surface p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={compris} onChange={(e) => setCompris(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[#34d399]" />
            <span className="text-[14px] leading-relaxed text-doux">
              J&apos;ai compris qu&apos;aucun outil ne garantit des gains : Pilote cherche les cotes mal ajustées et gère le risque, mais une série de pertes reste possible. Je ne mise
              que de l&apos;argent que je peux me permettre de perdre et j&apos;ai plus de 18 ans.
            </span>
          </label>
        </section>

        <Bouton
          className="w-full text-[15px]"
          couleur="#34d399"
          disabled={!valide}
          onClick={() =>
            terminerOnboarding({
              bankrollInitiale: b,
              objectif: avecObjectif ? { montant: o, date: dateObj } : null,
              profil,
              allocation: alloc,
            })
          }
        >
          Démarrer
        </Bouton>
        <p className="pb-6 text-center text-[11px] leading-relaxed text-faible">
          Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé).
        </p>
      </div>
    </div>
  );
}
