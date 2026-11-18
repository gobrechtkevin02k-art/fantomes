"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Actu } from "@/lib/actus";
import { useStore } from "@/lib/store";
import { Vide } from "@/components/ui";
import { IcJournal } from "@/components/Icones";
import { CarteActu, CLE_ACTUS_VUES } from "@/components/Actus";

export default function Actus() {
  const { pret, etat } = useStore();
  const [actus, setActus] = useState<Actu[] | null>(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    const charger = () =>
      fetch(`/api/actus${etat.onboarding ? `?id=${encodeURIComponent(etat.profilId)}` : ""}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { actus: Actu[]; admin: boolean }) => {
          if (!actif) return;
          setActus(d.actus);
          setAdmin(d.admin);
          try {
            if (d.actus[0]) localStorage.setItem(CLE_ACTUS_VUES, d.actus[0].t);
          } catch {
            /* stockage indisponible */
          }
        })
        .catch(() => actif && setActus([]));
    charger();
    const t = setInterval(charger, 60_000);
    return () => {
      actif = false;
      clearInterval(t);
    };
  }, [pret, etat.onboarding, etat.profilId]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-objectif/15 text-xl text-objectif">
            <IcJournal />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Actualités</h1>
            <p className="text-[14px] text-doux">Résultats, annonces et bilans du compte, gains comme pertes.</p>
          </div>
        </div>
        {admin && (
          <Link href="/admin" className="shrink-0 rounded-xl bg-texte px-3.5 py-2 text-[13px] font-semibold text-fond">
            Publier
          </Link>
        )}
      </div>

      {!actus ? (
        <div className="h-48 animate-pulse rounded-2xl border border-ligne bg-surface" />
      ) : actus.length === 0 ? (
        <Vide titre="Pas encore d'actualité" icone={<IcJournal />}>
          Les résultats et les annonces apparaîtront ici.
        </Vide>
      ) : (
        <div className="space-y-3">
          {actus.map((a) => (
            <CarteActu key={a.id} a={a} />
          ))}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-faible">
        Les résultats passés ne préjugent pas des résultats futurs. Le journal complet et vérifiable du compte est dans{" "}
        <Link href="/resultats" className="underline">
          Résultats
        </Link>
        . Interdit aux moins de 18 ans. Jouer comporte des risques : endettement, isolement, dépendance. Pour être aidé, appelez le 09 74 75 13 13 (appel non surtaxé).
      </p>
    </div>
  );
}
