"use client";

// Carte d'une actualité (fil public et page admin).

import type { Actu } from "@/lib/actus";
import { eurSigne } from "@/lib/format";
import { Badge, Carte } from "./ui";

export const CLE_ACTUS_VUES = "pilote:actus-vues:v1";

const TYPES: Record<Actu["type"], { l: string; c: string }> = {
  resultat: { l: "Résultat", c: "#34d399" },
  annonce: { l: "Annonce", c: "#a78bfa" },
  bilan_auto: { l: "Bilan automatique", c: "#fbbf24" },
};
const STATUTS: Record<string, string> = { gagne: "gagné", perdu: "perdu", en_cours: "en cours", rembourse: "remboursé", cashout: "cash-out", inconnu: "?" };

export function CarteActu({ a, onSupprimer }: { a: Actu; onSupprimer?: () => void }) {
  const t = TYPES[a.type];
  const net = a.bilan?.net;
  return (
    <Carte accent={t.c}>
      <div className="flex items-center justify-between gap-2">
        <Badge couleur={t.c}>{t.l}</Badge>
        <span className="text-[12px] text-faible">{new Date(a.t).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <h2 className="mt-2 text-[17px] font-bold tracking-tight" style={{ color: net === undefined ? undefined : net > 0 ? "#34d399" : net < 0 ? "#f87171" : undefined }}>
        {a.titre}
      </h2>
      <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed text-doux">{a.texte}</p>
      {a.paris && a.paris.length > 0 && (
        <ul className="mt-3 divide-y divide-ligne rounded-xl border border-ligne text-[13px]">
          {a.paris.map((p, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate">
                {p.selection}
                {p.cote ? ` à ${p.cote.toFixed(2).replace(".", ",")}` : ""} · {STATUTS[p.statut]}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {p.profit !== null && (
                  <span className="num font-semibold" style={{ color: p.profit > 0 ? "#34d399" : p.profit < 0 ? "#f87171" : "#8b97a4" }}>
                    {eurSigne(p.profit)}
                  </span>
                )}
                <Badge couleur={p.verifie ? "#34d399" : "#8b97a4"}>{p.verifie ? "✓ dans le journal" : "hors journal"}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
      {a.image && (
        <a href={a.image} target="_blank" rel="noopener noreferrer" className="mt-3 block overflow-hidden rounded-xl border border-ligne">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.image} alt="Capture Winamax jointe" className="max-h-80 w-full object-cover object-top" loading="lazy" />
        </a>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-faible">
        <span>
          {a.type === "bilan_auto"
            ? "Généré automatiquement à partir du journal public."
            : a.auto
              ? "Publié automatiquement après lecture de la capture par l'IA (chiffres contrôlés)."
              : a.type === "resultat"
                ? "Publié après relecture de la capture."
                : ""}
        </span>
        {onSupprimer && (
          <button onClick={onSupprimer} className="font-semibold text-negatif hover:underline">
            Retirer
          </button>
        )}
      </div>
    </Carte>
  );
}

