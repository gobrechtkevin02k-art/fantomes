"use client";

// Briques d'interface réutilisables.

import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Mode } from "@/lib/types";
import { IcFermer } from "./Icones";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const COULEUR_MODE: Record<Mode, string> = { classique: "#34d399", objectif: "#a78bfa", jackpot: "#fbbf24" };
export const NOM_MODE: Record<Mode, string> = { classique: "Classique", objectif: "Objectif cote", jackpot: "Jackpot" };

export function Carte({ children, className, accent }: { children: ReactNode; className?: string; accent?: string }) {
  return (
    <section
      className={cx("relative overflow-hidden rounded-2xl border border-ligne bg-surface/90 p-4 shadow-[0_1px_0_rgb(255_255_255/0.03)_inset] sm:p-5", className)}
      style={accent ? { boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.03), inset 3px 0 0 ${accent}` } : undefined}
    >
      {children}
    </section>
  );
}

export function Titre({ children, sous, action }: { children: ReactNode; sous?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
        {sous && <p className="mt-0.5 text-[13px] text-doux">{sous}</p>}
      </div>
      {action}
    </div>
  );
}

type VarianteBouton = "plein" | "contour" | "fantome" | "danger";

export function Bouton({
  variante = "plein",
  couleur,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBouton; couleur?: string }) {
  const styles: Record<VarianteBouton, string> = {
    plein: "bg-texte text-fond hover:bg-white",
    contour: "border border-ligne bg-surface-2 text-texte hover:bg-surface-3",
    fantome: "text-doux hover:bg-surface-2 hover:text-texte",
    danger: "border border-negatif/40 bg-negatif/10 text-negatif hover:bg-negatif/20",
  };
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        styles[variante],
        className,
      )}
      style={couleur && variante === "plein" ? { background: couleur, color: "#090c11", ...rest.style } : rest.style}
    >
      {children}
    </button>
  );
}

export function LienBouton({ href, children, className, couleur }: { href: string; children: ReactNode; className?: string; couleur?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ligne bg-surface-2 px-4 text-[14px] font-semibold text-texte transition hover:bg-surface-3",
        className,
      )}
      style={couleur ? { borderColor: `${couleur}55` } : undefined}
    >
      {children}
    </a>
  );
}

export function Badge({ children, couleur = "#8b97a4", className }: { children: ReactNode; couleur?: string; className?: string }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", className)}
      style={{ color: couleur, background: `${couleur}1a`, boxShadow: `inset 0 0 0 1px ${couleur}33` }}
    >
      {children}
    </span>
  );
}

export function Stat({ label, valeur, sous, couleur, grand }: { label: string; valeur: ReactNode; sous?: ReactNode; couleur?: string; grand?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-doux">{label}</div>
      <div className={cx("num truncate font-semibold tracking-tight", grand ? "text-2xl" : "text-[17px]")} style={couleur ? { color: couleur } : undefined}>
        {valeur}
      </div>
      {sous && <div className="num text-[12px] text-doux">{sous}</div>}
    </div>
  );
}

export function couleurConfiance(v: number): string {
  if (v >= 80) return "#34d399";
  if (v >= 65) return "#a3e635";
  if (v >= 50) return "#fbbf24";
  return "#f87171";
}

export function libelleConfiance(v: number): string {
  if (v >= 85) return "Très forte";
  if (v >= 70) return "Forte";
  if (v >= 60) return "Correcte";
  if (v >= 50) return "Faible";
  return "Défavorable";
}

export function Jauge({ valeur, taille = 58, epaisseur = 5 }: { valeur: number; taille?: number; epaisseur?: number }) {
  const r = (taille - epaisseur) / 2 - 1;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, valeur));
  const col = couleurConfiance(v);
  return (
    <div className="relative shrink-0" style={{ width: taille, height: taille }} role="img" aria-label={`Indice de confiance ${Math.round(v)} sur 100`}>
      <svg width={taille} height={taille} className="-rotate-90">
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="#222c38" strokeWidth={epaisseur} />
        <circle
          cx={taille / 2}
          cy={taille / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={epaisseur}
          strokeLinecap="round"
          strokeDasharray={`${(c * v) / 100} ${c}`}
          style={{ filter: `drop-shadow(0 0 6px ${col}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="num font-bold" style={{ color: col, fontSize: taille * 0.3 }}>
          {Math.round(v)}
        </span>
        {taille >= 54 && <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-faible">indice</span>}
      </div>
    </div>
  );
}

export function Barre({ valeur, couleur = "#e9eef3", hauteur = 6, fond = "#222c38" }: { valeur: number; couleur?: string; hauteur?: number; fond?: string }) {
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height: hauteur, background: fond }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(1, valeur)) * 100}%`, background: couleur }} />
    </div>
  );
}

export function Puces<T extends string | number>({
  options,
  valeur,
  onChange,
  couleur,
  label,
}: {
  options: { v: T; l: ReactNode }[];
  valeur: T;
  onChange: (v: T) => void;
  couleur?: string;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const actif = o.v === valeur;
        return (
          <button
            key={String(o.v)}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => onChange(o.v)}
            className={cx("num min-h-10 rounded-xl border px-3.5 text-[14px] font-semibold transition", actif ? "text-fond" : "border-ligne bg-surface-2 text-texte hover:bg-surface-3")}
            style={actif ? { background: couleur ?? "#e9eef3", borderColor: couleur ?? "#e9eef3" } : undefined}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

export function Champ({
  label,
  aide,
  suffixe,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; aide?: ReactNode; suffixe?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-doux">
        {label}
      </label>
      <div className="flex items-center rounded-xl border border-ligne bg-surface-2 focus-within:border-doux">
        <input id={id} {...rest} className="num min-h-11 w-full min-w-0 bg-transparent px-3 text-[15px] text-texte outline-none placeholder:text-faible" />
        {suffixe && <span className="pr-3 text-[14px] text-doux">{suffixe}</span>}
      </div>
      {aide && <p className="mt-1 text-[12px] text-faible">{aide}</p>}
    </div>
  );
}

export function Modal({ ouvert, onFermer, titre, children }: { ouvert: boolean; onFermer: () => void; titre: string; children: ReactNode }) {
  useEffect(() => {
    if (!ouvert) return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", f);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", f);
      document.body.style.overflow = o;
    };
  }, [ouvert, onFermer]);
  if (!ouvert) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={titre}>
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onFermer} aria-label="Fermer" />
      <div className="apparait relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-ligne bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[17px] font-semibold tracking-tight">{titre}</h3>
          <button onClick={onFermer} className="grid size-9 place-items-center rounded-full text-doux hover:bg-surface-2 hover:text-texte" aria-label="Fermer">
            <IcFermer className="text-lg" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Vide({ titre, children, icone }: { titre: string; children?: ReactNode; icone?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ligne px-5 py-10 text-center">
      {icone && <div className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-surface-2 text-xl text-doux">{icone}</div>}
      <p className="font-semibold">{titre}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-[14px] text-doux">{children}</div>}
    </div>
  );
}

export function Interrupteur({ actif, onChange, label }: { actif: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={label}
      onClick={() => onChange(!actif)}
      className={cx("relative h-7 w-12 shrink-0 rounded-full transition", actif ? "bg-classique" : "bg-surface-3")}
    >
      <span className={cx("absolute top-1 size-5 rounded-full bg-white transition-all", actif ? "left-6" : "left-1")} />
    </button>
  );
}
