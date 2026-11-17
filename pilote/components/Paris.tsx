"use client";

// Cartes de sélection, de combiné et fenêtre d'enregistrement d'un pari.

import { useState } from "react";
import type { Jambe, Mode, Pari, Selection } from "@/lib/types";
import type { ResultatMise } from "@/lib/engine/mise";
import type { PropositionCombo } from "@/lib/engine/combos";
import { useStore } from "@/lib/store";
import { useDonnees } from "@/lib/donnees";
import { cote, dateCourte, dateMatch, eur, pct, pctSigne, uid } from "@/lib/format";
import { emojiSport, nomSport } from "@/lib/sports";
import { Badge, Barre, Bouton, COULEUR_MODE, Carte, Champ, Jauge, LienBouton, Modal, cx, libelleConfiance } from "./ui";
import { IcAlerte, IcChevron, IcCopier, IcExterne, IcValider } from "./Icones";

const WINAMAX = "https://www.winamax.fr/paris-sportifs";

/** Lien vers Winamax : on n'accepte que des liens https vers winamax.fr. */
export function lienWinamax(lien?: string): string {
  if (!lien) return WINAMAX;
  try {
    const u = new URL(lien);
    if (u.protocol === "https:" && (u.hostname === "winamax.fr" || u.hostname.endsWith(".winamax.fr"))) return u.toString();
  } catch {
    /* lien invalide */
  }
  return WINAMAX;
}

function versJambe(s: Selection): Jambe {
  return {
    selectionId: s.id,
    eventId: s.eventId,
    sportKey: s.sportKey,
    sportTitle: s.sportTitle,
    commence: s.commence,
    home: s.home,
    away: s.away,
    market: s.market,
    issue: s.issue,
    point: s.point,
    label: s.label,
    odds: s.odds,
    fairProb: s.fairProb,
    statut: "en_cours",
  };
}

export interface ProjetPari {
  mode: Mode;
  titre: string;
  jambes: Selection[];
  cote: number;
  mise: number;
  confiance: number;
  edge: number;
  proba: number;
}

export function ModalPari({ projet, onFermer }: { projet: ProjetPari | null; onFermer: () => void }) {
  const { ajouterPari } = useStore();
  const { source, notifier } = useDonnees();
  const [mise, setMise] = useState("");
  const [coteObtenue, setCoteObtenue] = useState("");
  const [cle, setCle] = useState<string | null>(null);

  const idProjet = projet ? projet.jambes.map((j) => j.id).join("~") + projet.mise : null;
  if (projet && cle !== idProjet) {
    setCle(idProjet);
    setMise(projet.mise.toFixed(2).replace(".", ","));
    setCoteObtenue(projet.cote.toFixed(2).replace(".", ","));
  }
  if (!projet) return null;

  const m = Number(mise.replace(",", "."));
  const c = Number(coteObtenue.replace(",", "."));
  const valide = m > 0 && c > 1;
  const couleur = COULEUR_MODE[projet.mode];
  const texte = projet.jambes.map((j) => `${j.home} – ${j.away} : ${j.label} @ ${cote(j.odds)}`).join("\n");
  const lien = projet.jambes.length === 1 ? lienWinamax(projet.jambes[0].link) : WINAMAX;

  const enregistrer = () => {
    if (!valide) return;
    // Si la cote a bougé, on recalcule l'espérance avec la cote réellement obtenue.
    const edge = projet.proba * c - 1;
    const p: Pari = {
      id: uid(),
      creeLe: new Date().toISOString(),
      mode: projet.mode,
      jambes: projet.jambes.map(versJambe),
      cote: Math.round(c * 100) / 100,
      mise: Math.round(m * 100) / 100,
      confiance: projet.confiance,
      edge,
      probaEstimee: projet.proba,
      statut: "en_cours",
      ...(source === "demo" ? { demo: true } : {}),
    };
    ajouterPari(p);
    notifier(`Pari enregistré : ${eur(p.mise)} à ${cote(p.cote)}.`, "succes");
    onFermer();
  };

  return (
    <Modal ouvert onFermer={onFermer} titre="Placer le pari">
      <div className="space-y-4">
        <div className="rounded-2xl border border-ligne bg-surface-2 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Badge couleur={couleur}>{projet.titre}</Badge>
            <span className="text-[12px] text-doux">{projet.jambes.length > 1 ? `Combiné de ${projet.jambes.length} sélections` : "Pari simple"}</span>
          </div>
          <ul className="space-y-1.5">
            {projet.jambes.map((j) => (
              <li key={j.id} className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="min-w-0">
                  <span className="font-medium">{j.label}</span>
                  <span className="block truncate text-[12px] text-doux">
                    {j.home} – {j.away} · {dateMatch(j.commence)}
                  </span>
                </span>
                <span className="num font-semibold">{cote(j.odds)}</span>
              </li>
            ))}
          </ul>
        </div>

        <ol className="space-y-2 text-[14px] text-doux">
          <li>
            <span className="font-semibold text-texte">1.</span> Ouvre Winamax et ajoute {projet.jambes.length > 1 ? "ces sélections à un combiné" : "cette sélection"}.
          </li>
          <li>
            <span className="font-semibold text-texte">2.</span> Mise le montant conseillé, puis note ici la cote réellement obtenue.
          </li>
        </ol>

        <div className="flex gap-2">
          <LienBouton href={lien} className="flex-1" couleur={couleur}>
            Ouvrir Winamax <IcExterne />
          </LienBouton>
          <Bouton
            variante="contour"
            onClick={() => {
              navigator.clipboard?.writeText(texte).then(
                () => notifier("Sélection copiée.", "info"),
                () => notifier("Copie impossible sur cet appareil.", "alerte"),
              );
            }}
            aria-label="Copier la sélection"
          >
            <IcCopier />
          </Bouton>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Champ label="Mise" inputMode="decimal" value={mise} onChange={(e) => setMise(e.target.value)} suffixe="€" />
          <Champ label="Cote obtenue" inputMode="decimal" value={coteObtenue} onChange={(e) => setCoteObtenue(e.target.value)} />
        </div>
        {c > 0 && Math.abs(c - projet.cote) / projet.cote > 0.03 && (
          <p className="flex items-start gap-2 rounded-xl bg-alerte/10 p-3 text-[13px] text-alerte">
            <IcAlerte className="mt-0.5 shrink-0" />
            La cote a bougé ({cote(projet.cote)} → {cote(c)}). Espérance recalculée : {pctSigne(projet.proba * c - 1)}.
            {projet.proba * c - 1 < 0 && " Elle est maintenant négative : tu peux renoncer."}
          </p>
        )}
        <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
          <span className="text-[13px] text-doux">Gain potentiel</span>
          <span className="num text-lg font-bold" style={{ color: couleur }}>
            {valide ? eur(m * c) : "—"}
          </span>
        </div>
        <Bouton className="w-full" couleur={couleur} disabled={!valide} onClick={enregistrer}>
          <IcValider /> J&apos;ai placé ce pari
        </Bouton>
      </div>
    </Modal>
  );
}

function Facteurs({ s }: { s: Selection }) {
  const items: [string, number, string][] = [
    ["Profondeur du marché", s.facteurs.marche, `${s.books} bookmaker${s.books > 1 ? "s" : ""} de référence${s.sharp ? " dont un « sharp »" : ""}`],
    ["Accord des bookmakers", s.facteurs.accord, s.books < 2 ? "Une seule référence" : "Écart entre les estimations"],
    ["Délai avant le match", s.facteurs.delai, "Plus le match approche, plus les cotes sont fiables"],
    ["Niveau de cote", s.facteurs.niveau, "Les très grosses cotes sont plus difficiles à estimer"],
  ];
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {items.map(([l, v, d]) => (
        <div key={l}>
          <div className="mb-1 flex justify-between text-[12px]">
            <span className="text-doux">{l}</span>
            <span className="num font-semibold">{v}</span>
          </div>
          <Barre valeur={v / 100} hauteur={4} couleur={v >= 75 ? "#34d399" : v >= 55 ? "#fbbf24" : "#f87171"} />
          <p className="mt-1 text-[11px] text-faible">{d}</p>
        </div>
      ))}
    </div>
  );
}

export function EnteteMatch({ s }: { s: Pick<Selection, "sportKey" | "sportTitle" | "commence" | "home" | "away"> }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[12px] text-doux">
        <span aria-hidden>{emojiSport(s.sportKey)}</span>
        <span className="truncate">{nomSport(s.sportKey, s.sportTitle)}</span>
        <span className="text-faible">·</span>
        <span className="shrink-0">{dateMatch(s.commence)}</span>
      </div>
      <div className="mt-0.5 truncate text-[15px] font-semibold tracking-tight">
        {s.home} <span className="text-faible">–</span> {s.away}
      </div>
    </div>
  );
}

export function CarteSelection({
  s,
  mise,
  mode,
  horsBudget,
  dejaJoue,
  onParier,
}: {
  s: Selection;
  mise: ResultatMise;
  mode: Mode;
  horsBudget?: boolean;
  dejaJoue?: boolean;
  onParier: (p: ProjetPari) => void;
}) {
  const [details, setDetails] = useState(false);
  const couleur = COULEUR_MODE[mode];
  const positif = s.edge > 0;
  return (
    <Carte className="apparait">
      <div className="flex items-start justify-between gap-3">
        <EnteteMatch s={s} />
        <Jauge valeur={s.confidence} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="size-1.5 rounded-full" style={{ background: couleur }} />
        <span className="text-[15px] font-semibold">{s.label}</span>
        {dejaJoue && <Badge>Déjà joué</Badge>}
        {horsBudget && <Badge couleur="#fbbf24">Hors budget du jour</Badge>}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3">
        <div>
          <div className="text-[11px] text-doux">Cote Winamax</div>
          <div className="num text-lg font-bold">{cote(s.odds)}</div>
        </div>
        <div>
          <div className="text-[11px] text-doux">Cote juste</div>
          <div className="num text-lg font-semibold text-doux">{cote(s.fairOdds)}</div>
        </div>
        <div>
          <div className="text-[11px] text-doux">Avantage</div>
          <div className="num text-lg font-bold" style={{ color: positif ? "#34d399" : "#f87171" }}>
            {pctSigne(s.edge)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[12px] text-doux">Mise calculée</div>
          <div className="num text-2xl font-bold tracking-tight" style={{ color: mise.mise > 0 ? couleur : undefined }}>
            {mise.mise > 0 ? eur(mise.mise) : "—"}
          </div>
          <div className="text-[12px] text-doux">
            {mise.mise > 0 ? `${pct(mise.pctBankroll, 2)} de ta bankroll · gain ${eur(mise.mise * s.odds)}` : mise.explication}
          </div>
        </div>
        <div className="text-right text-[12px] text-doux">
          Confiance
          <div className="font-semibold text-texte">{libelleConfiance(s.confidence)}</div>
        </div>
      </div>

      <button onClick={() => setDetails((d) => !d)} className="mt-3 flex items-center gap-1 text-[13px] font-medium text-doux hover:text-texte" aria-expanded={details}>
        <IcChevron className={cx("transition", details && "rotate-90")} /> Pourquoi cette mise ?
      </button>
      {details && (
        <div className="apparait mt-3 space-y-3 border-t border-ligne pt-3">
          <p className="text-[13px] text-doux">
            Probabilité estimée <span className="num font-semibold text-texte">{pct(s.fairProb)}</span> contre{" "}
            <span className="num font-semibold text-texte">{pct(s.impliedProb)}</span> pour Winamax. L&apos;indice {Math.round(s.confidence)} signifie que, selon le modèle, il y a {Math.round(s.confidence)} % de chances que
            cette cote soit réellement au-dessus du juste prix.
          </p>
          {mise.mise > 0 && <p className="num rounded-lg bg-surface-2 p-2.5 text-[12px] text-doux">{mise.explication}</p>}
          <Facteurs s={s} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <LienBouton href={lienWinamax(s.link)} couleur={couleur}>
          Winamax <IcExterne />
        </LienBouton>
        <Bouton
          couleur={couleur}
          variante={mise.mise > 0 ? "plein" : "contour"}
          disabled={mise.bloque}
          onClick={() =>
            onParier({ mode, titre: mode === "jackpot" ? "Jackpot" : "Classique", jambes: [s], cote: s.odds, mise: mise.mise > 0 ? mise.mise : 1, confiance: s.confidence, edge: s.edge, proba: s.fairProb })
          }
        >
          {mise.mise > 0 ? (
            <>
              <IcValider /> J&apos;ai parié
            </>
          ) : (
            "Parier quand même"
          )}
        </Bouton>
      </div>
    </Carte>
  );
}

export function CarteCombo({ c, mise, mode, onParier }: { c: PropositionCombo; mise: ResultatMise; mode: Mode; onParier: (p: ProjetPari) => void }) {
  const [ouvert, setOuvert] = useState(c.jambes.length <= 4);
  const couleur = COULEUR_MODE[mode];
  return (
    <Carte className="apparait" accent={couleur}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-semibold tracking-tight">{c.titre}</h3>
            <Badge couleur={couleur}>{c.jambes.length} sélection{c.jambes.length > 1 ? "s" : ""}</Badge>
          </div>
          <p className="mt-0.5 text-[13px] text-doux">{c.description}</p>
        </div>
        <Jauge valeur={c.confiance} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3">
        <div>
          <div className="text-[11px] text-doux">Cote totale</div>
          <div className="num text-lg font-bold" style={{ color: couleur }}>
            {cote(c.cote)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-doux">Chances de passer</div>
          <div className="num text-lg font-semibold">{pct(c.probaJuste, c.probaJuste < 0.01 ? 2 : 1)}</div>
        </div>
        <div>
          <div className="text-[11px] text-doux">Espérance</div>
          <div className="num text-lg font-bold" style={{ color: c.edge >= 0 ? "#34d399" : "#f87171" }}>
            {pctSigne(c.edge)}
          </div>
        </div>
      </div>

      <button onClick={() => setOuvert((o) => !o)} className="mt-3 flex items-center gap-1 text-[13px] font-medium text-doux hover:text-texte" aria-expanded={ouvert}>
        <IcChevron className={cx("transition", ouvert && "rotate-90")} /> {ouvert ? "Masquer" : "Voir"} les sélections ·{" "}
        {dateCourte(c.premierMatch) === dateCourte(c.dernierMatch) ? `le ${dateCourte(c.premierMatch)}` : `du ${dateCourte(c.premierMatch)} au ${dateCourte(c.dernierMatch)}`}
      </button>
      {ouvert && (
        <ul className="mt-2 divide-y divide-ligne rounded-xl border border-ligne">
          {c.jambes.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium">{s.label}</div>
                <div className="truncate text-[12px] text-doux">
                  {emojiSport(s.sportKey)} {s.home} – {s.away} · {dateMatch(s.commence)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="num font-semibold">{cote(s.odds)}</div>
                <div className="num whitespace-nowrap text-[11px]" style={{ color: s.edge >= 0 ? "#34d399" : "#8b97a4" }}>
                  {pctSigne(s.edge)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-[12px] text-doux">Mise calculée</div>
          <div className="num text-2xl font-bold tracking-tight" style={{ color: mise.mise > 0 ? couleur : undefined }}>
            {mise.mise > 0 ? eur(mise.mise) : "—"}
          </div>
          <div className="text-[12px] text-doux">{mise.mise > 0 ? `Gain potentiel ${eur(mise.mise * c.cote)}` : mise.explication}</div>
        </div>
        <Bouton
          couleur={couleur}
          disabled={mise.bloque}
          onClick={() => onParier({ mode, titre: mode === "jackpot" ? "Jackpot" : "Objectif cote", jambes: c.jambes, cote: c.cote, mise: mise.mise > 0 ? mise.mise : 1, confiance: c.confiance, edge: c.edge, proba: c.probaJuste })}
        >
          <IcValider /> Parier
        </Bouton>
      </div>
    </Carte>
  );
}
