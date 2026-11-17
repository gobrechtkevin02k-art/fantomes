"use client";

// Le conseiller à l'écran : récap depuis la dernière visite, plan du jour en sessions horaires,
// validation des paris en un clic, analyse IA optionnelle.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pari, Selection } from "@/lib/types";
import type { ItemPlan, Plan, Session } from "@/lib/engine/conseiller";
import { recapDepuis } from "@/lib/engine/conseiller";
import { parties } from "@/lib/engine/temps";
import { useStore } from "@/lib/store";
import { useDonnees, usePlan } from "@/lib/donnees";
import { useAutonomie } from "@/lib/autonomie";
import { lienWinamax, WINAMAX } from "@/lib/winamax";
import { cote, dansCombien, dateMatch, eur, eurSigne, pct } from "@/lib/format";
import { emojiSport } from "@/lib/sports";
import { Badge, Bouton, COULEUR_MODE, Carte, Jauge, LienBouton, Modal, cx } from "./ui";
import { IcAlerte, IcChevron, IcCopier, IcEclair, IcExterne, IcValider, Logo } from "./Icones";
import { Cadenas, Verrou } from "./Offres";

const VERDICTS = {
  confirmer: { l: "Confirmé par l'analyse", c: "#34d399" },
  prudence: { l: "Prudence", c: "#fbbf24" },
  eviter: { l: "À éviter", c: "#f87171" },
} as const;

const domaine = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Analyse complète de l'IA pour une sélection (à la demande, ou automatique selon les réglages). */
export function PanneauAnalyse({ s, auto = false }: { s: Selection; auto?: boolean }) {
  const { statut, analyses, demanderAnalyse, droits } = useDonnees();
  const a = analyses[s.id];
  const [ouvert, setOuvert] = useState(auto);
  const lance = useRef(false);

  useEffect(() => {
    if (auto && statut?.ia && !a && !lance.current) {
      lance.current = true;
      demanderAnalyse(s);
    }
  }, [auto, statut?.ia, a, s, demanderAnalyse]);

  if (!statut?.ia) return null;
  if (droits.analysesIAParJour <= 0 && !a) return <Verrou test={(d) => d.analysesIAParJour > 0} texte="Analyse complète de l'IA" />;
  if (!a) {
    return (
      <button onClick={() => (setOuvert(true), demanderAnalyse(s))} className="flex items-center gap-1.5 text-[13px] font-semibold text-objectif hover:underline">
        <IcEclair /> Voir l&apos;analyse complète de l&apos;IA
      </button>
    );
  }
  if (a.etat === "chargement") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-[13px] text-doux">
        <span className="size-3 animate-pulse rounded-full bg-objectif" />
        L&apos;analyste cherche les dernières infos (compositions, absences, contexte)… environ 30 secondes.
      </div>
    );
  }
  if (a.etat === "erreur") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-negatif/10 p-3 text-[12px] text-negatif">
        <span>{a.erreur}</span>
        <button className="font-semibold underline" onClick={() => demanderAnalyse(s)}>
          Réessayer
        </button>
      </div>
    );
  }
  const x = a.analyse;
  const v = VERDICTS[x.verdict];
  return (
    <div className="rounded-xl border border-ligne bg-surface-2/60 p-3">
      <button onClick={() => setOuvert((o) => !o)} className="flex w-full items-start justify-between gap-2 text-left" aria-expanded={ouvert}>
        <div>
          <Badge couleur={v.c}>{v.l}</Badge>
          <p className="mt-1.5 text-[13px] leading-relaxed">{x.resume}</p>
        </div>
        <IcChevron className={cx("mt-1 shrink-0 text-doux transition", ouvert && "rotate-90")} />
      </button>
      {ouvert && (
        <div className="apparait mt-3 space-y-3 border-t border-ligne pt-3 text-[13px]">
          {x.infosCles.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-faible">Infos de dernière minute</div>
              <ul className="list-inside list-disc space-y-0.5 text-doux">
                {x.infosCles.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-positif">Pour</div>
              <ul className="space-y-0.5 text-doux">{x.pointsForts.length ? x.pointsForts.map((i) => <li key={i}>+ {i}</li>) : <li>—</li>}</ul>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-negatif">Contre</div>
              <ul className="space-y-0.5 text-doux">{x.pointsFaibles.length ? x.pointsFaibles.map((i) => <li key={i}>− {i}</li>) : <li>—</li>}</ul>
            </div>
          </div>
          <p className="rounded-lg bg-surface-3/60 p-2.5 text-doux">
            <span className="font-semibold text-texte">Sur la mise : </span>
            {x.avisMise}
          </p>
          {x.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {x.sources.slice(0, 6).map((src) => (
                <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-ligne px-2 py-0.5 text-[11px] text-doux hover:text-texte" title={src.titre}>
                  {domaine(src.url)}
                </a>
              ))}
            </div>
          )}
          <p className="text-[11px] text-faible">
            Analyse de l&apos;IA à {new Date(x.genereLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · confiance de l&apos;analyste {x.confianceAnalyste}/100. Elle peut se tromper :
            vérifie les infos importantes.
          </p>
        </div>
      )}
    </div>
  );
}

function LigneItem({ it, auto }: { it: ItemPlan; auto: boolean }) {
  const { etat } = useStore();
  const simple = etat.reglages.conseiller.modeSimple;
  const s = it.selections[0];
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <Jauge valeur={it.confiance} taille={42} epaisseur={4} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-semibold">{s.label}</span>
            {it.boost > 1.001 && <Badge couleur="#fbbf24">Mise relevée</Badge>}
          </div>
          <div className="truncate text-[12px] text-doux">
            {emojiSport(s.sportKey)} {s.home} – {s.away} · {dateMatch(s.commence)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="num text-[16px] font-bold" style={{ color: COULEUR_MODE.classique }}>
            {eur(it.mise)}
          </div>
          <div className="num text-[12px] text-doux">@ {cote(it.cote)}</div>
        </div>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-doux">{it.message}</p>
      {!simple && (
        <p className="num mt-1 text-[11px] text-faible">
          Juste prix {cote(s.fairOdds)} · avantage {pct(s.edge)} · {s.books} bookmakers{it.boost > 1.001 ? ` · gestion : ${eur(it.miseBase)} → ${eur(it.mise)}` : ""}
        </p>
      )}
      <div className="mt-2">
        <PanneauAnalyse s={s} auto={auto} />
      </div>
    </li>
  );
}

function lienItems(items: ItemPlan[]): string {
  return items.length === 1 && items[0].selections.length === 1 ? lienWinamax(items[0].selections[0].link) : WINAMAX;
}

export function BlocSession({ session, maintenant, enAvant }: { session: Session; maintenant: number; enAvant?: boolean }) {
  const { etat } = useStore();
  const { validerItems } = useAutonomie();
  const { statut } = useDonnees();
  const ref = useRef<HTMLDivElement>(null);
  const auto = etat.reglages.conseiller.analyseAuto && !!statut?.ia;
  const ouverte = session.ouverte || Date.parse(session.heure) <= maintenant;

  useEffect(() => {
    if (enAvant) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [enAvant]);

  const valider = () => {
    window.open(lienItems(session.items), "_blank", "noopener");
    validerItems(session.items);
  };

  return (
    <div ref={ref} className={cx("rounded-2xl border bg-surface-2/40 p-3.5 transition", enAvant ? "border-classique shadow-[0_0_0_3px_rgb(52_211_153/0.15)]" : "border-ligne")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cx("rounded-lg px-2 py-0.5 text-[13px] font-bold", ouverte ? "bg-classique text-fond" : "bg-surface-3 text-texte")}>{session.libelle}</span>
          <span className="text-[12px] text-doux">
            {session.raison}
            {!ouverte && ` · ${dansCombien(session.heure, maintenant)}`}
          </span>
        </div>
        <span className="num text-[13px] font-semibold">{eur(session.total)}</span>
      </div>
      <ul className="divide-y divide-ligne">
        {session.items.map((it) => (
          <LigneItem key={it.id} it={it} auto={auto} />
        ))}
      </ul>
      {ouverte ? (
        <Bouton className="mt-1 w-full text-[15px]" couleur="#34d399" onClick={valider}>
          <IcValider /> Valider {session.items.length > 1 ? `ces ${session.items.length} paris` : "ce pari"} · {eur(session.total)}
        </Bouton>
      ) : (
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-center rounded-xl bg-surface-3/60 px-3 py-2.5 text-center text-[13px] text-doux">Je te préviens à {session.libelle}</div>
          <Bouton variante="contour" onClick={valider}>
            Valider maintenant quand même
          </Bouton>
        </div>
      )}
    </div>
  );
}

function salutation(t: number, tz: string) {
  const h = parties(t, tz).heure;
  return h < 5 ? "Bonsoir" : h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

function Recap({ paris, onCompris }: { paris: Pari[]; onCompris: () => void }) {
  const { etat } = useStore();
  const { maintenant } = useDonnees();
  const depuis = etat.derniereVisite ? Date.parse(etat.derniereVisite) : 0;
  const recap = useMemo(() => (depuis ? recapDepuis(paris, depuis, maintenant, etat.reglages.conseiller.fuseau) : null), [paris, depuis, maintenant, etat.reglages.conseiller.fuseau]);
  if (!recap) return null;
  return (
    <div className="apparait rounded-2xl border border-ligne bg-surface-2/50 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-faible">{recap.periode}</div>
          <div className="num text-2xl font-bold" style={{ color: recap.profit >= 0 ? "#34d399" : "#f87171" }}>
            {eurSigne(recap.profit)}
          </div>
        </div>
        <Bouton variante="fantome" className="min-h-9 px-3 text-[13px]" onClick={onCompris}>
          Compris
        </Bouton>
      </div>
      <p className="mt-1 text-[14px] leading-relaxed text-doux">{recap.message.slice(recap.periode.length + 3).replace(/^./, (c) => c.toUpperCase())}</p>
      <ul className="mt-2 space-y-1">
        {recap.paris.slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="truncate">
              <span className={cx("mr-1.5 inline-block size-1.5 rounded-full align-middle", p.statut === "gagne" ? "bg-positif" : p.statut === "perdu" ? "bg-negatif" : "bg-doux")} />
              {p.jambes.length > 1 ? `Combiné ${p.jambes.length} sélections` : p.jambes[0]?.label}
            </span>
            <span className="num shrink-0 font-semibold" style={{ color: (p.gain ?? 0) - p.mise >= 0 ? "#34d399" : "#f87171" }}>
              {eurSigne((p.gain ?? 0) - p.mise)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BanniereNotifications() {
  const { notifications, activerNotifications } = useAutonomie();
  const [masque, setMasque] = useState(false);
  if (masque || notifications === "actif" || notifications === "chargement" || notifications === "non_supporte" || notifications === "serveur_absent") return null;
  if (notifications === "offre") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-ligne bg-surface-2/50 p-3 text-[13px]">
        <span className="text-doux">Récap du matin et rappels à l&apos;heure de jouer : disponibles avec une offre payante.</span>
        <Verrou test={(d) => d.notifMatin} className="shrink-0" />
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-objectif/30 bg-objectif/10 p-3 text-[13px]">
      <IcAlerte className="mt-0.5 shrink-0 text-objectif" />
      <div className="flex-1">
        {notifications === "ios_installer" ? (
          <p className="text-texte">
            Pour recevoir mes notifications sur iPhone, ajoute d&apos;abord Pilote à l&apos;écran d&apos;accueil (bouton Partager → « Sur l&apos;écran d&apos;accueil »), puis ouvre-le depuis
            l&apos;icône.
          </p>
        ) : notifications === "refuse" ? (
          <p className="text-texte">Les notifications sont bloquées pour Pilote. Autorise-les dans les réglages de ton navigateur pour que je te prévienne.</p>
        ) : (
          <>
            <p className="text-texte">Active les notifications : je t&apos;envoie le bilan de la nuit à 7h et je te préviens à chaque heure de jeu.</p>
            <Bouton className="mt-2 min-h-9 text-[13px]" couleur="#a78bfa" onClick={activerNotifications}>
              Activer les notifications
            </Bouton>
          </>
        )}
      </div>
      <button onClick={() => setMasque(true)} className="text-faible hover:text-texte" aria-label="Masquer">
        ✕
      </button>
    </div>
  );
}

export function ModalTicket() {
  const { ticket, fermerTicket } = useAutonomie();
  const { notifier } = useDonnees();
  const [faits, setFaits] = useState<Set<string>>(new Set());
  if (!ticket) return null;
  const total = ticket.reduce((t, p) => t + p.mise, 0);
  return (
    <Modal
      ouvert
      onFermer={() => {
        setFaits(new Set());
        fermerTicket();
      }}
      titre="C'est validé"
    >
      <p className="text-[14px] text-doux">
        {ticket.length > 1 ? `${ticket.length} paris enregistrés` : "Pari enregistré"} pour {eur(total)}. Winamax s&apos;est ouvert : reproduis {ticket.length > 1 ? "chaque ligne" : "la ligne"} ci-dessous, je
        m&apos;occupe du reste (suivi et résultats automatiques).
      </p>
      <ul className="mt-4 space-y-2">
        {ticket.map((p) => {
          const fait = faits.has(p.id);
          const texte = p.jambes.map((j) => `${j.home} – ${j.away} : ${j.label} @ ${cote(j.odds)}`).join("\n") + `\nMise : ${eur(p.mise)}`;
          return (
            <li key={p.id} className={cx("rounded-xl border p-3 transition", fait ? "border-classique/40 bg-classique/5" : "border-ligne bg-surface-2")}>
              <div className="flex items-start gap-3">
                <button
                  onClick={() => setFaits((f) => new Set(f.has(p.id) ? [...f].filter((x) => x !== p.id) : [...f, p.id]))}
                  className={cx("mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border", fait ? "border-classique bg-classique text-fond" : "border-doux")}
                  aria-label={fait ? "Marquer comme non placé" : "Marquer comme placé sur Winamax"}
                >
                  {fait && <IcValider />}
                </button>
                <div className="min-w-0 flex-1">
                  {p.jambes.map((j) => (
                    <div key={j.selectionId} className="text-[14px]">
                      <span className="font-semibold">{j.label}</span> <span className="num text-doux">@ {cote(j.odds)}</span>
                      <div className="truncate text-[12px] text-doux">
                        {j.home} – {j.away} · {dateMatch(j.commence)}
                      </div>
                    </div>
                  ))}
                  <div className="num mt-1 text-[15px] font-bold" style={{ color: COULEUR_MODE[p.mode] }}>
                    Mise {eur(p.mise)} {p.jambes.length > 1 && <span className="text-[12px] font-normal text-doux">(combiné à {cote(p.cote)})</span>}
                  </div>
                </div>
                <button
                  onClick={() => navigator.clipboard?.writeText(texte).then(() => notifier("Copié.", "info"))}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-doux hover:bg-surface-3 hover:text-texte"
                  aria-label="Copier"
                >
                  <IcCopier />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <LienBouton href={WINAMAX}>
          Winamax <IcExterne />
        </LienBouton>
        <Bouton
          couleur="#34d399"
          onClick={() => {
            setFaits(new Set());
            fermerTicket();
          }}
        >
          Terminé
        </Bouton>
      </div>
      <p className="mt-3 text-[11px] text-faible">Si la cote a changé sur Winamax, corrige-la dans Suivi : je recalculerai tout.</p>
    </Modal>
  );
}

function PlusTard({ plan, maintenant }: { plan: Plan; maintenant: number }) {
  const [ouvert, setOuvert] = useState(false);
  if (!plan.plusTard.length && !plan.ecartes.length) return null;
  return (
    <div>
      <button onClick={() => setOuvert((o) => !o)} className="flex items-center gap-1 text-[13px] font-medium text-doux hover:text-texte" aria-expanded={ouvert}>
        <IcChevron className={cx("transition", ouvert && "rotate-90")} />
        {plan.plusTard.length > 0 && `${plan.plusTard.length} à surveiller les prochains jours`}
        {plan.plusTard.length > 0 && plan.ecartes.length > 0 && " · "}
        {plan.ecartes.length > 0 && `${plan.ecartes.length} écarté${plan.ecartes.length > 1 ? "s" : ""}`}
      </button>
      {ouvert && (
        <div className="apparait mt-2 space-y-2">
          {plan.plusTard.map((it) => (
            <div key={it.id} className="rounded-xl border border-ligne p-3 text-[13px]">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{it.selections[0].label}</span>
                <span className="num text-doux">
                  {eur(it.mise)} @ {cote(it.cote)}
                </span>
              </div>
              <div className="text-[12px] text-doux">
                {it.selections[0].home} – {it.selections[0].away} · {dateMatch(it.selections[0].commence, maintenant)}
              </div>
              <p className="mt-1 text-[12px] text-doux">{it.message}</p>
            </div>
          ))}
          {plan.ecartes.map((e) => (
            <div key={e.selection.id} className="rounded-xl border border-dashed border-ligne p-3 text-[13px]">
              <span className="font-semibold">{e.selection.label}</span>
              <span className="text-doux"> · {e.selection.home} – {e.selection.away}</span>
              <p className="mt-1 text-[12px] text-doux">{e.raison}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CarteConseiller({ sessionCible }: { sessionCible?: string | null }) {
  const { etat, marquerVisite } = useStore();
  const { maintenant, chargement, source, statut } = useDonnees();
  const plan = usePlan();
  const tz = etat.reglages.conseiller.fuseau;
  const couleurVerdict = plan.verdict === "jouer" ? "#34d399" : plan.verdict === "attendre" || plan.verdict === "limite" ? "#fbbf24" : "#8b97a4";

  return (
    <Carte className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Logo className="size-10" />
          <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface bg-classique" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">{salutation(maintenant, tz)} ! Ici ton conseiller.</div>
          <div className="text-[12px] text-doux">
            {chargement && !source ? "J'analyse les cotes…" : `Analyse ${source === "live" ? "des cotes Winamax en direct" : "des cotes de démonstration"} · ${new Date(maintenant).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
          </div>
        </div>
      </div>

      <BanniereNotifications />
      <Recap paris={etat.paris} onCompris={marquerVisite} />

      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-bold tracking-tight">{plan.titre}</h2>
          <span className="size-2 rounded-full" style={{ background: couleurVerdict }} />
        </div>
        <p className="mt-1 text-[14px] leading-relaxed text-doux">{plan.message}</p>
      </div>

      {plan.sessions.length > 0 && (
        <div className="space-y-3">
          {plan.sessions.map((s) => (
            <BlocSession key={s.id} session={s} maintenant={maintenant} enAvant={sessionCible === s.id} />
          ))}
        </div>
      )}
      {sessionCible && !plan.sessions.some((s) => s.id === sessionCible) && plan.verdict === "jouer" && (
        <p className="rounded-xl bg-surface-2 p-3 text-[13px] text-doux">Les cotes ont bougé depuis la notification : voici le plan mis à jour.</p>
      )}

      {plan.verrouilles.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-ligne p-3.5">
          <div className="flex items-center gap-2 text-[13px] text-doux">
            <Cadenas className="text-base" />
            <span>
              {plan.verrouilles.length} autre{plan.verrouilles.length > 1 ? "s" : ""} pari{plan.verrouilles.length > 1 ? "s" : ""} solide{plan.verrouilles.length > 1 ? "s" : ""} aujourd&apos;hui (indice
              jusqu&apos;à {Math.round(Math.max(...plan.verrouilles.map((i) => i.confiance)))})
            </span>
          </div>
          <Verrou test={(d) => d.parisParJour > plan.limite} className="shrink-0" />
        </div>
      )}
      <PlusTard plan={plan} maintenant={maintenant} />
      {statut && !statut.ia && plan.sessions.length > 0 && (
        <p className="text-[12px] text-faible">Astuce : active l&apos;analyste IA (clé ANTHROPIC_API_KEY sur le serveur) pour que je vérifie compositions et absences avant chaque pari.</p>
      )}
    </Carte>
  );
}
