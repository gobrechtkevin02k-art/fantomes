"use client";

// Carte « En direct » : paris Classique en cours de match, probabilité actuelle et conseil de cash-out (offre Élite).

import { useEffect, useMemo, useState } from "react";
import type { EvaluationDirect } from "@/lib/engine/direct";
import { useStore } from "@/lib/store";
import { useCalculs, useDonnees } from "@/lib/donnees";
import { cote, eur, pct } from "@/lib/format";
import { Badge, Barre, Carte, Titre } from "./ui";
import { Verrou } from "./Offres";

const CONSEILS = {
  garder: { l: "On laisse courir", c: "#8b97a4" },
  securiser: { l: "Sécuriser possible", c: "#34d399" },
  limiter: { l: "Limiter la casse", c: "#fbbf24" },
} as const;

export default function CarteDirect() {
  const { etat } = useStore();
  const { droits, maintenant } = useDonnees();
  const { bk } = useCalculs();
  const [evals, setEvals] = useState<EvaluationDirect[]>([]);
  const [majLe, setMajLe] = useState<string | null>(null);

  const enDirect = useMemo(
    () => etat.paris.filter((p) => p.mode === "classique" && p.statut === "en_cours" && p.jambes.some((j) => j.statut === "en_cours" && Date.parse(j.commence) <= maintenant)),
    [etat.paris, maintenant],
  );
  const signature = enDirect.map((p) => p.id).join(",");

  useEffect(() => {
    if (!droits.direct || !signature) return;
    let actif = true;
    const charger = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profilId: etat.profilId, paris: enDirect, bankroll: bk.total, marches: etat.reglages.marches }),
        });
        const d = (await res.json()) as { evaluations?: EvaluationDirect[]; majLe?: string };
        if (actif && d.evaluations) {
          setEvals(d.evaluations);
          setMajLe(d.majLe ?? null);
        }
      } catch {
        /* réseau indisponible */
      }
    };
    charger();
    const t = setInterval(charger, 3 * 60_000);
    return () => {
      actif = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droits.direct, signature]);

  if (!enDirect.length) return null;

  if (!droits.direct) {
    return (
      <Carte accent="#fbbf24">
        <Titre sous="Je les règle automatiquement à la fin du match." action={<Verrou test={(d) => d.direct} />}>
          {enDirect.length} pari{enDirect.length > 1 ? "s" : ""} en cours de match
        </Titre>
        <p className="text-[13px] text-doux">Avec Élite, je suis le match en direct et je te préviens s&apos;il vaut mieux sécuriser un gain ou limiter une perte avec le cash-out.</p>
      </Carte>
    );
  }

  return (
    <Carte accent="#fbbf24">
      <Titre sous={majLe ? `Mis à jour à ${new Date(majLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · toutes les 3 minutes` : "Chargement…"}>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-negatif" /> En direct
        </span>
      </Titre>
      <ul className="space-y-3">
        {enDirect.map((p) => {
          const e = evals.find((x) => x.pariId === p.id);
          const c = e ? CONSEILS[e.conseil] : null;
          return (
            <li key={p.id} className="rounded-xl border border-ligne bg-surface-2/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold">{p.jambes.length > 1 ? `Combiné à ${cote(p.cote)}` : p.jambes[0]?.label}</div>
                  <div className="truncate text-[12px] text-doux">
                    {e?.jambes
                      .filter((j) => j.enCours)
                      .map((j) => `${j.match}${j.score ? ` · ${j.score}` : ""}`)
                      .join(" | ") || `${p.jambes[0]?.home} – ${p.jambes[0]?.away}`}
                  </div>
                </div>
                {c && <Badge couleur={c.c}>{c.l}</Badge>}
              </div>
              {e && (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <Barre valeur={e.pLive} couleur={e.pLive >= 0.6 ? "#34d399" : e.pLive >= 0.3 ? "#fbbf24" : "#f87171"} />
                    <span className="num w-12 text-right text-[13px] font-semibold">{pct(e.pLive, 0)}</span>
                  </div>
                  <div className="num mt-1 flex justify-between text-[12px] text-doux">
                    <span>
                      Mise {eur(p.mise)} · gain possible {eur(e.gainPotentiel)}
                    </span>
                    <span>valeur juste {eur(e.valeurJuste)}</span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-doux">{e.message}</p>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-faible">
        Le cash-out se fait sur Winamax. En moyenne il coûte un peu : je ne le conseille que pour sécuriser un gain important ou récupérer au moins la valeur juste.
      </p>
    </Carte>
  );
}
