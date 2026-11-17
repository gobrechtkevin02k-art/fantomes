"use client";

// Courbe d'évolution de la bankroll (SVG, sans dépendance).

import { useMemo, useState } from "react";
import type { PointHistorique } from "@/lib/engine/bankroll";
import { dateCourte, eur } from "@/lib/format";

export default function Graphique({ points, depart, hauteur = 150, objectif }: { points: PointHistorique[]; depart: number; hauteur?: number; objectif?: number }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const L = 600;
  const H = hauteur;
  const pad = { h: 10, b: 18, g: 0, d: 0 };

  const g = useMemo(() => {
    if (points.length < 2) return null;
    const xs = points.map((p) => Date.parse(p.date));
    const ys = points.map((p) => p.total);
    const x0 = xs[0];
    const x1 = Math.max(xs[xs.length - 1], x0 + 1);
    let y0 = Math.min(...ys, depart);
    let y1 = Math.max(...ys, depart);
    if (objectif && objectif < y1 * 1.4) y1 = Math.max(y1, objectif);
    const marge = (y1 - y0) * 0.12 || 1;
    y0 -= marge;
    y1 += marge;
    // Abscisse par rang pour éviter les points écrasés quand beaucoup de paris sont réglés le même jour.
    const X = (i: number) => pad.g + (i / (points.length - 1)) * (L - pad.g - pad.d);
    const Y = (v: number) => pad.h + (1 - (v - y0) / (y1 - y0)) * (H - pad.h - pad.b);
    const d = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.total).toFixed(1)}`).join(" ");
    const aire = `${d} L${X(points.length - 1).toFixed(1)},${H - pad.b} L${X(0).toFixed(1)},${H - pad.b} Z`;
    return { d, aire, X, Y, y0, y1, x0, x1 };
  }, [points, depart, objectif, H, pad.b, pad.d, pad.g, pad.h]);

  if (!g) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-ligne text-[13px] text-faible" style={{ height: H }}>
        La courbe apparaîtra après tes premiers paris réglés.
      </div>
    );
  }
  const dernier = points[points.length - 1].total;
  const couleur = dernier >= depart ? "#34d399" : "#f87171";
  const i = survol ?? points.length - 1;
  const p = points[i];

  return (
    <div>
      <div className="mb-1 flex justify-between text-[12px] text-doux">
        <span className="num">{survol !== null ? `${dateCourte(p.date)} · ${eur(p.total)}` : ""}</span>
      </div>
      <svg
        viewBox={`0 0 ${L} ${H}`}
        className="w-full touch-none"
        style={{ height: H }}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Évolution de la bankroll, de ${eur(points[0].total)} à ${eur(dernier)}`}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const f = (e.clientX - r.left) / r.width;
          setSurvol(Math.max(0, Math.min(points.length - 1, Math.round(f * (points.length - 1)))));
        }}
        onPointerLeave={() => setSurvol(null)}
      >
        <defs>
          <linearGradient id="aire-bk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={couleur} stopOpacity="0.28" />
            <stop offset="1" stopColor={couleur} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={L} y1={g.Y(depart)} y2={g.Y(depart)} stroke="#5d6875" strokeDasharray="3 5" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {objectif && objectif <= g.y1 && (
          <line x1="0" x2={L} y1={g.Y(objectif)} y2={g.Y(objectif)} stroke="#a78bfa" strokeDasharray="6 6" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
        <path d={g.aire} fill="url(#aire-bk)" />
        <path d={g.d} fill="none" stroke={couleur} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {survol !== null && <line x1={g.X(i)} x2={g.X(i)} y1={0} y2={H - pad.b} stroke="#8b97a4" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        <circle cx={g.X(i)} cy={g.Y(p.total)} r="4" fill={couleur} stroke="#090c11" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="num mt-1 flex justify-between text-[11px] text-faible">
        <span>{dateCourte(points[0].date)}</span>
        <span>
          {objectif && objectif <= g.y1 && <span className="mr-3 text-objectif">— objectif</span>}
          <span>--- départ</span>
        </span>
        <span>{dateCourte(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}
