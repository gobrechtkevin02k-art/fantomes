"use client";

// Page publique à partager : présente l'appli mobile et explique comment l'installer selon l'appareil.

import Link from "next/link";
import { AVANTAGES, GuideInstallation } from "@/components/Installation";
import { Carte, Titre } from "@/components/ui";
import { IcValider } from "@/components/Icones";
import { useStore } from "@/lib/store";

const QUESTIONS = [
  {
    q: "C'est gratuit ?",
    r: "Installer Pilote ne coûte rien. L'offre Découverte reste gratuite ; les offres payantes débloquent plus de paris par jour, les notifications et le suivi en direct.",
  },
  {
    q: "Pourquoi Pilote n'est pas sur l'App Store ou le Play Store ?",
    r: "Pilote s'installe directement depuis son site : tu as toujours la dernière version, sans attendre une validation, et sans commission des stores sur les abonnements. Apple et Google encadrent aussi très strictement les applis liées aux paris d'argent.",
  },
  {
    q: "Mes paris sont-ils gardés si je ferme l'appli ?",
    r: "Oui. Tes paris, ta bankroll et tes réglages restent sur ton téléphone. Avec une offre payante, une copie est envoyée au serveur pour que l'agent puisse te prévenir même appli fermée et pour retrouver tes données sur un autre appareil.",
  },
  {
    q: "Pilote place-t-elle les paris à ma place ?",
    r: "Non. Pilote choisit les paris et calcule la mise ; tu valides toi-même chaque pari sur Winamax : l'appli ouvre le bon match et copie la mise.",
  },
];

export default function Installer() {
  const { etat } = useStore();
  return (
    <div className="space-y-5 pt-2 pb-6">
      <section className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-classique">Appli mobile</p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">Pilote dans ta poche</h1>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-doux">
            Le plan du jour, l'heure de jouer et tes résultats, sur ton téléphone. Une notification quand c'est le moment, un geste pour valider.
          </p>
          <ul className="mt-4 space-y-2.5">
            {AVANTAGES.map((a) => (
              <li key={a.titre} className="flex gap-2.5 text-[14px] leading-relaxed text-doux">
                <IcValider className="mt-1 shrink-0 text-classique" />
                <span>
                  <b className="text-texte">{a.titre}.</b> {a.texte}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {/* Aperçu de l'appli dans un cadre de téléphone */}
        <div className="mx-auto hidden w-[240px] shrink-0 rounded-[38px] border border-ligne bg-surface-3 p-2 shadow-2xl shadow-black/60 sm:block">
          <div className="relative overflow-hidden rounded-[30px] bg-fond">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icones/capture-plan.png" alt="L'écran d'accueil de Pilote sur un téléphone" width={390} height={844} className="block h-auto w-full" />
            <div className="absolute top-2 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
          </div>
        </div>
      </section>

      <Carte accent="#34d399">
        <Titre sous="La marche à suivre s'adapte à ton appareil.">Installer Pilote</Titre>
        <GuideInstallation choixAppareil />
      </Carte>

      <Carte>
        <Titre>Questions fréquentes</Titre>
        <div className="divide-y divide-ligne">
          {QUESTIONS.map((x) => (
            <details key={x.q} className="group py-3 first:pt-0 last:pb-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-semibold">
                {x.q}
                <span className="text-doux transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed text-doux">{x.r}</p>
            </details>
          ))}
        </div>
      </Carte>

      {!etat.onboarding && (
        <div className="text-center">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-texte px-5 text-[14px] font-semibold text-fond">
            Découvrir Pilote
          </Link>
        </div>
      )}

      <p className="text-center text-[11px] leading-relaxed text-faible">
        Interdit aux moins de 18 ans. Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé).
      </p>
    </div>
  );
}
