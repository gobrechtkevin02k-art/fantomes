"use client";

// Petits éléments pour les fonctionnalités réservées à une offre supérieure.

import Link from "next/link";
import type { ReactNode } from "react";
import { offrePour, type Droits } from "@/lib/offres";
import { cx } from "./ui";

export function Cadenas({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Pastille « Débloquer avec Pro » qui mène à la page des offres. */
export function Verrou({ test, texte, className }: { test: (d: Droits) => boolean; texte?: string; className?: string }) {
  const o = offrePour(test);
  return (
    <Link
      href="/offres"
      className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold", className)}
      style={{ color: o.couleur, background: `${o.couleur}1a`, boxShadow: `inset 0 0 0 1px ${o.couleur}40` }}
    >
      <Cadenas /> {texte ?? `Avec ${o.nom}`}
    </Link>
  );
}

/** Écran affiché à la place d'une page réservée. */
export function PageVerrouillee({ test, titre, children, icone }: { test: (d: Droits) => boolean; titre: string; children: ReactNode; icone?: ReactNode }) {
  const o = offrePour(test);
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl text-2xl" style={{ color: o.couleur, background: `${o.couleur}1a` }}>
        {icone ?? <Cadenas />}
      </div>
      <h1 className="text-xl font-bold tracking-tight">{titre}</h1>
      <div className="mt-2 text-[14px] leading-relaxed text-doux">{children}</div>
      <Link href="/offres" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold text-fond" style={{ background: o.couleur }}>
        <Cadenas /> Débloquer avec {o.nom}
      </Link>
    </div>
  );
}
