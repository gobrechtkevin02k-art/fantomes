"use client";

// Coque de l'application : en-tête, navigation, notifications, mentions de jeu responsable.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { useCalculs, useDonnees } from "@/lib/donnees";
import { depuis, eur } from "@/lib/format";
import { IcAccueil, IcBouclier, IcCible, IcDiamant, IcEclair, IcGraphique, IcRafraichir, IcReglages, Logo } from "./Icones";
import { cx } from "./ui";
import Onboarding from "./Onboarding";
import { ModalTicket } from "./Conseiller";
import { Cadenas } from "./Offres";

const NAV = [
  { href: "/", label: "Accueil", Icone: IcAccueil, couleur: "#e9eef3" },
  { href: "/classique", label: "Classique", Icone: IcBouclier, couleur: "#34d399" },
  { href: "/objectif", label: "Objectif", Icone: IcCible, couleur: "#a78bfa" },
  { href: "/jackpot", label: "Jackpot", Icone: IcDiamant, couleur: "#fbbf24" },
  { href: "/suivi", label: "Suivi", Icone: IcGraphique, couleur: "#e9eef3" },
];

function Source() {
  const { source, majLe, chargement, rafraichir } = useDonnees();
  return (
    <div className="flex items-center gap-1.5">
      {source && (
        <Link
          href="/reglages#donnees"
          className="hidden items-center gap-1.5 rounded-full border border-ligne bg-surface-2 px-2.5 py-1 text-[11px] font-semibold sm:inline-flex"
          title={majLe ? `Mis à jour ${depuis(majLe)}` : undefined}
        >
          <span className={cx("size-1.5 rounded-full", source === "live" ? "bg-classique" : "bg-jackpot")} />
          {source === "live" ? "Cotes Winamax en direct" : "Mode démo"}
        </Link>
      )}
      {source === "demo" && (
        <Link href="/reglages#donnees" className="rounded-full bg-jackpot/15 px-2 py-1 text-[11px] font-semibold text-jackpot sm:hidden">
          Démo
        </Link>
      )}
      <button
        onClick={() => rafraichir(true)}
        className="grid size-10 place-items-center rounded-full text-doux transition hover:bg-surface-2 hover:text-texte"
        aria-label="Actualiser les cotes"
        title={majLe ? `Cotes mises à jour ${depuis(majLe)}` : "Actualiser les cotes"}
      >
        <IcRafraichir className={cx("text-lg", chargement && "tourne")} />
      </button>
    </div>
  );
}

function Toasts() {
  const { toasts } = useDonnees();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="apparait pointer-events-auto max-w-md rounded-xl border px-4 py-2.5 text-[14px] font-medium shadow-2xl backdrop-blur"
          style={{
            background: "rgb(16 21 28 / 0.95)",
            borderColor: t.ton === "succes" ? "#34d39966" : t.ton === "alerte" ? "#fbbf2466" : "#222c38",
            color: t.ton === "succes" ? "#6ee7b7" : t.ton === "alerte" ? "#fcd34d" : "#e9eef3",
          }}
        >
          {t.texte}
        </div>
      ))}
    </div>
  );
}

function Bankroll() {
  const { bk } = useCalculs();
  const delta = bk.total - bk.apports;
  return (
    <Link href="/suivi" className="rounded-xl px-2 py-1 text-right leading-tight transition hover:bg-surface-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-faible">Bankroll</div>
      <div className="num text-[15px] font-bold">
        {eur(bk.total)}{" "}
        <span className="text-[11px] font-semibold" style={{ color: delta >= 0 ? "#34d399" : "#f87171" }}>
          {delta >= 0 ? "+" : "−"}
          {eur(Math.abs(delta), 0)}
        </span>
      </div>
    </Link>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const { pret, etat } = useStore();
  const { droits } = useDonnees();
  const verrouille = (href: string) => (href === "/objectif" && !droits.objectifCote) || (href === "/jackpot" && !droits.jackpot);
  const chemin = usePathname();
  const actif = (href: string) => (href === "/" ? chemin === "/" : chemin.startsWith(href));

  if (!pret) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Logo className="size-12 animate-pulse" />
      </div>
    );
  }
  if (!etat.onboarding) return <Onboarding />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl">
      <Toasts />
      <ModalTicket />
      {/* Navigation latérale (ordinateur) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-ligne px-3 py-5 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <Logo className="size-8" />
          <span className="text-[17px] font-bold tracking-tight">Pilote</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {[...NAV, { href: "/offres", label: "Offres", Icone: IcEclair, couleur: "#fbbf24" }, { href: "/reglages", label: "Réglages", Icone: IcReglages, couleur: "#e9eef3" }].map(({ href, label, Icone, couleur }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition",
                actif(href) ? "bg-surface-2 text-texte" : "text-doux hover:bg-surface hover:text-texte",
              )}
            >
              <Icone className="text-lg" style={{ color: actif(href) ? couleur : undefined }} />
              {label}
              {verrouille(href) && <Cadenas className="ml-auto text-faible" />}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-ligne p-3 text-[11px] leading-relaxed text-faible">
          Interdit aux moins de 18 ans. Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé).
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 border-b border-ligne/70 bg-fond/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-2 px-4">
            <Link href="/" className="flex items-center gap-2 md:hidden">
              <Logo className="size-7" />
              <span className="text-[16px] font-bold tracking-tight">Pilote</span>
            </Link>
            <div className="hidden md:block" />
            <div className="flex items-center gap-1">
              <Source />
              <Bankroll />
              <Link href="/reglages" className="grid size-10 place-items-center rounded-full text-doux hover:bg-surface-2 hover:text-texte md:hidden" aria-label="Réglages">
                <IcReglages className="text-lg" />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 pt-5 pb-8 md:pb-12">{children}</main>

        <footer className="pb-nav mx-auto max-w-4xl px-4 text-[11px] leading-relaxed text-faible md:hidden">
          <p className="border-t border-ligne pt-4">
            Interdit aux moins de 18 ans. Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé).
          </p>
        </footer>
      </div>

      {/* Barre d'onglets (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ligne bg-fond/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map(({ href, label, Icone, couleur }) => (
            <Link key={href} href={href} className="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium" style={{ color: actif(href) ? couleur : "#5d6875" }}>
              <Icone className="text-[22px]" />
              {label}
              {verrouille(href) && <Cadenas className="absolute top-1.5 right-[22%] text-[11px]" />}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
