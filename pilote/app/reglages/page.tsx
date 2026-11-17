"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketKey, Mode, Profil, SportInfo } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useAutonomie } from "@/lib/autonomie";
import { OFFRES, prixMensuel, type Droits } from "@/lib/offres";
import { Verrou } from "@/components/Offres";
import Link from "next/link";
import type { EtatApp, ReglagesConseiller } from "@/lib/types";
import { useCalculs, useDonnees } from "@/lib/donnees";
import { FRACTION_KELLY, LIBELLE_PROFIL, MISE_MAX_PCT } from "@/lib/engine/mise";
import { MODES } from "@/lib/engine/bankroll";
import { dateLongue, depuis, eur, pct, uid } from "@/lib/format";
import { CATALOGUE, emojiSport } from "@/lib/sports";
import { Bouton, COULEUR_MODE, Carte, Champ, Interrupteur, NOM_MODE, Titre, cx } from "@/components/ui";
import { IcAlerte, IcExterne } from "@/components/Icones";

function ChampNombre({
  label,
  valeur,
  onCommit,
  min = 0,
  max = Infinity,
  suffixe,
  aide,
  pas,
}: {
  label: string;
  valeur: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  suffixe?: string;
  aide?: string;
  pas?: number;
}) {
  const [t, setT] = useState(String(valeur).replace(".", ","));
  const precedent = useRef(valeur);
  useEffect(() => {
    if (precedent.current !== valeur) {
      precedent.current = valeur;
      setT(String(valeur).replace(".", ","));
    }
  }, [valeur]);
  const commit = () => {
    const n = Number(t.replace(",", "."));
    if (!Number.isFinite(n)) return setT(String(valeur).replace(".", ","));
    let v = Math.min(max, Math.max(min, n));
    if (pas) v = Math.round(v / pas) * pas;
    v = Math.round(v * 1000) / 1000;
    precedent.current = v;
    setT(String(v).replace(".", ","));
    if (v !== valeur) onCommit(v);
  };
  return <Champ label={label} inputMode="decimal" value={t} onChange={(e) => setT(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} suffixe={suffixe} aide={aide} />;
}

const MARCHES: { k: MarketKey; l: string; d: string }[] = [
  { k: "h2h", l: "Vainqueur (1N2)", d: "Le marché le plus liquide et le mieux estimé." },
  { k: "totals", l: "Plus / Moins", d: "Nombre de buts ou de points." },
  { k: "spreads", l: "Handicap", d: "Utile surtout au basket et au football américain." },
];

export default function Reglages() {
  const { etat, majReglages, remplacer, reinitialiser, ajouterMouvement } = useStore();
  const { source, quota, majLe, erreursApi, rafraichir, notifier, statut, abonnement, droits } = useDonnees();
  const { notifications, activerNotifications, desactiverNotifications, testerNotification } = useAutonomie();
  const [code, setCode] = useState("");
  const cs = etat.reglages.conseiller;
  const majConseiller = (c: Partial<ReglagesConseiller>) => majReglages({ conseiller: { ...etat.reglages.conseiller, ...c } });
  const { bk } = useCalculs();
  const r = etat.reglages;
  const [alloc, setAlloc] = useState<Record<Mode, number>>(r.allocation);
  const [sportsApi, setSportsApi] = useState<SportInfo[]>([]);
  const fichier = useRef<HTMLInputElement>(null);

  useEffect(() => setAlloc(r.allocation), [r.allocation]);
  useEffect(() => {
    fetch("/api/sports")
      .then((x) => x.json())
      .then((d: { sports?: SportInfo[] }) => setSportsApi(d.sports ?? []))
      .catch(() => {});
  }, []);

  const totalAlloc = MODES.reduce((s, m) => s + (alloc[m] || 0), 0);
  const cout = r.sports.length * r.marches.length;
  const toggleSport = (k: string) => majReglages({ sports: r.sports.includes(k) ? r.sports.filter((s) => s !== k) : [...r.sports, k] });
  const autres = sportsApi.filter((s) => !CATALOGUE.some((c) => c.key === s.key));
  const pause = r.pause && Date.parse(r.pause) > Date.now() ? r.pause : null;

  const exporter = () => {
    const blob = new Blob([JSON.stringify(etat, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pilote-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Réglages</h1>
        <p className="text-[14px] text-doux">Tout est enregistré sur cet appareil. Pense à exporter une sauvegarde de temps en temps.</p>
      </div>

      <Carte accent={OFFRES[abonnement.offre].couleur}>
        <Titre
          sous={
            abonnement.geste === "complet"
              ? "Accès complet offert (propriétaire)."
              : abonnement.finPeriode && abonnement.statut === "actif"
                ? `Renouvellement le ${dateLongue(abonnement.finPeriode)}`
                : prixMensuel(abonnement.offre)
          }
          action={
            <Link href="/offres" className="text-[13px] font-semibold" style={{ color: OFFRES[abonnement.offre].couleur }}>
              {abonnement.offre === "elite" ? "Gérer" : "Voir les offres"}
            </Link>
          }
        >
          Mon offre : {OFFRES[abonnement.offre].nom}
        </Titre>
        <p className="text-[13px] text-doux">
          {Number.isFinite(droits.parisParJour) ? `${droits.parisParJour} pari${droits.parisParJour > 1 ? "s" : ""} Classique par jour` : "Paris Classique illimités"} ·{" "}
          {droits.analysesIAParJour ? `${droits.analysesIAParJour} analyse${droits.analysesIAParJour > 1 ? "s" : ""} IA par jour` : "pas d'analyse IA"} ·{" "}
          {droits.direct ? "suivi en direct" : droits.tempsReel ? "temps réel" : droits.notifMatin ? "récap du matin" : "sans notification"}
        </p>
      </Carte>

      <Carte accent="#34d399">
        <Titre sous="Comment ton conseiller décide et te parle. Il n'accompagne que le mode Classique.">Ton conseiller</Titre>
        <div className="divide-y divide-ligne">
          {(
            [
              ["modeSimple", "Mode simple", "Interface épurée : tu lis et tu cliques. Les chiffres détaillés restent accessibles d'un geste."],
              ["conviction", "Le conseiller peut relever les mises", "Quand l'indice de confiance et la cote sont exceptionnels, il mise plus que la gestion de bankroll, sans jamais dépasser le plafond de sécurité de ton profil."],
              ["attendreCompos", "Attendre les compositions (football)", "Il programme les paris de foot environ une heure avant le match, une fois les compositions officielles connues, sauf si la cote risque de baisser."],
              ["analyseAuto", "Afficher automatiquement l'analyse complète de l'IA", "Sinon, un bouton « Voir l'analyse complète » te laisse l'ouvrir quand tu veux. Chaque analyse a un coût d'API."],
            ] as [keyof ReglagesConseiller, string, string][]
          ).map(([k, l, d]) => {
            const test: ((x: Droits) => boolean) | null = k === "conviction" ? (x) => x.conviction : k === "analyseAuto" ? (x) => x.analysesIAParJour > 0 : null;
            const bloque = test !== null && !test(droits);
            return (
              <div key={k} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                <div>
                  <div className="text-[14px] font-medium">{l}</div>
                  <div className="text-[12px] leading-relaxed text-doux">{d}</div>
                </div>
                {bloque && test ? <Verrou test={test} className="shrink-0" /> : <Interrupteur actif={!!cs[k]} label={l} onChange={(v) => majConseiller({ [k]: v })} />}
              </div>
            );
          })}
        </div>
        {cs.conviction && droits.conviction && (
          <div className="mt-2 border-t border-ligne pt-3">
            <div className="mb-2 text-[13px] font-medium text-doux">Mise relevée au maximum de</div>
            <div className="flex gap-2">
              {[1.25, 1.5, 2].map((b) => (
                <button
                  key={b}
                  onClick={() => majConseiller({ boostMax: b })}
                  className={cx("num min-h-10 flex-1 rounded-xl border text-[14px] font-semibold", cs.boostMax === b ? "border-texte bg-texte text-fond" : "border-ligne bg-surface-2")}
                >
                  ×{String(b).replace(".", ",")}
                </button>
              ))}
            </div>
          </div>
        )}
        {statut && !statut.ia && <p className="mt-3 text-[12px] text-faible">Analyse IA non activée sur ce serveur : ajoute la variable ANTHROPIC_API_KEY pour l&apos;activer.</p>}
      </Carte>

      <Carte>
        <Titre sous="Le bilan de la nuit le matin, puis un rappel à chaque heure de jeu.">Notifications</Titre>
        <div className="space-y-3 text-[14px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-doux">
              {
                {
                  chargement: "Vérification…",
                  non_supporte: "Ce navigateur ne gère pas les notifications.",
                  ios_installer: "Sur iPhone : ajoute d'abord Pilote à l'écran d'accueil, puis ouvre-le depuis l'icône.",
                  serveur_absent: "Le serveur n'a pas encore de clés de notification (VAPID).",
                  offre: "Incluses à partir de l'offre Essentiel (récap du matin) et Pro (heures de jeu, résultats).",
                  refuse: "Bloquées dans les réglages du navigateur.",
                  inactif: "Désactivées sur cet appareil.",
                  actif: "Activées sur cet appareil.",
                }[notifications]
              }
            </span>
            {notifications === "inactif" && (
              <Bouton className="min-h-10" couleur="#a78bfa" onClick={activerNotifications}>
                Activer
              </Bouton>
            )}
          </div>
          {notifications === "actif" && (
            <div className="flex flex-wrap gap-2">
              <Bouton variante="contour" className="min-h-10" onClick={testerNotification}>
                Envoyer un test
              </Bouton>
              <Bouton variante="fantome" className="min-h-10" onClick={desactiverNotifications}>
                Désactiver
              </Bouton>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-ligne pt-3">
            <span>Récapitulatif du matin à</span>
            <select
              value={cs.heureRecap}
              onChange={(e) => majConseiller({ heureRecap: Number(e.target.value) })}
              className="num min-h-10 rounded-xl border border-ligne bg-surface-2 px-3 text-[14px]"
              aria-label="Heure du récapitulatif"
            >
              {[6, 7, 8, 9, 10].map((h) => (
                <option key={h} value={h}>
                  {h}h00
                </option>
              ))}
            </select>
          </div>
          <p className="text-[12px] text-faible">
            Fuseau : {cs.fuseau}. Le récap n&apos;est envoyé que si tu n&apos;as pas déjà ouvert l&apos;appli ce matin.
            {statut && !statut.cron && " Pour les notifications appli fermée, le serveur doit être appelé toutes les 15 minutes (voir le README)."}
          </p>
        </div>
      </Carte>

      <Carte>
        <Titre sous="Pour retrouver tes données sur un autre appareil et permettre à l'agent de travailler appli fermée.">Synchronisation</Titre>
        {!droits.synchro ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-doux">La synchronisation multi-appareils est incluse à partir de l&apos;offre Essentiel.</p>
            <Verrou test={(x) => x.synchro} className="shrink-0" />
          </div>
        ) : statut?.stockage === "memoire" ? (
          <p className="text-[13px] text-doux">Pas de stockage serveur durable : ajoute une base Upstash Redis (gratuite) pour activer la synchronisation et les notifications appli fermée.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[13px] text-doux">Ton code personnel (garde-le secret)</div>
              <div className="flex items-center gap-2">
                <code className="num min-w-0 flex-1 truncate rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]">{etat.profilId}</code>
                <Bouton variante="contour" className="min-h-10" onClick={() => navigator.clipboard?.writeText(etat.profilId).then(() => notifier("Code copié.", "info"))}>
                  Copier
                </Bouton>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Champ className="flex-1" label="Reprendre depuis un autre appareil" placeholder="Colle ton code ici" value={code} onChange={(e) => setCode(e.target.value.trim())} />
              <Bouton
                variante="contour"
                disabled={code.length < 8}
                onClick={async () => {
                  const res = await fetch(`/api/sync?id=${encodeURIComponent(code)}`);
                  const d = (await res.json()) as { etat?: EtatApp; erreur?: string };
                  if (!d.etat) return notifier(d.erreur ?? "Code introuvable.", "alerte");
                  if (confirm("Remplacer les données de cet appareil par celles de ce code ?")) {
                    remplacer(d.etat);
                    setCode("");
                    notifier("Données récupérées.", "succes");
                  }
                }}
              >
                Récupérer
              </Bouton>
            </div>
          </div>
        )}
      </Carte>

      <Carte>
        <Titre sous="Point de départ de tous les calculs. Les dépôts et retraits se gèrent dans Suivi.">Bankroll</Titre>
        <div className="grid grid-cols-2 gap-3">
          <ChampNombre label="Bankroll de départ" valeur={r.bankrollInitiale} min={1} suffixe="€" onCommit={(v) => majReglages({ bankrollInitiale: v })} />
          <Champ
            label="Date de départ"
            type="date"
            value={r.dateDebut.slice(0, 10)}
            onChange={(e) => e.target.value && majReglages({ dateDebut: new Date(`${e.target.value}T00:00:00`).toISOString() })}
          />
        </div>
      </Carte>

      <div id="objectif" className="scroll-mt-20">
        <Carte>
          <Titre sous="Pilote mesure si tu es dans les temps, sans jamais augmenter le risque pour rattraper un retard." action={<Interrupteur actif={!!r.objectif} onChange={(v) => majReglages({ objectif: v ? { montant: Math.round(bk.total * 2), date: new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10) } : null })} label="Activer l'objectif" />}>
            Objectif
          </Titre>
          {r.objectif && (
            <div className="grid grid-cols-2 gap-3">
              <ChampNombre label="Montant à atteindre" valeur={r.objectif.montant} min={1} suffixe="€" onCommit={(v) => majReglages({ objectif: { ...r.objectif!, montant: v } })} />
              <Champ label="Avant le" type="date" value={r.objectif.date.slice(0, 10)} onChange={(e) => e.target.value && majReglages({ objectif: { ...r.objectif!, date: e.target.value } })} />
            </div>
          )}
        </Carte>
      </div>

      <Carte>
        <Titre sous="Règle la taille des mises du mode Classique.">Profil de risque</Titre>
        <div className="grid gap-2 sm:grid-cols-3">
          {(["prudent", "equilibre", "offensif"] as Profil[]).map((p) => (
            <button
              key={p}
              onClick={() => majReglages({ profil: p })}
              className={cx("rounded-2xl border p-3 text-left transition", r.profil === p ? "border-texte bg-surface-2" : "border-ligne hover:bg-surface-2")}
              aria-pressed={r.profil === p}
            >
              <div className="font-semibold">{LIBELLE_PROFIL[p]}</div>
              <div className="num mt-1 text-[12px] text-doux">
                Kelly × {FRACTION_KELLY[p]} · max {pct(MISE_MAX_PCT[p], 0)} par pari
              </div>
            </button>
          ))}
        </div>
      </Carte>

      <Carte>
        <Titre sous="Part de la bankroll réservée à chaque gamme. Le total doit faire 100 %.">Poches</Titre>
        <div className="grid grid-cols-3 gap-3">
          {MODES.map((m) => (
            <div key={m}>
              <label className="mb-1.5 block text-[13px] font-medium" style={{ color: COULEUR_MODE[m] }}>
                {NOM_MODE[m]}
              </label>
              <div className="flex items-center rounded-xl border border-ligne bg-surface-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={alloc[m]}
                  min={0}
                  max={100}
                  onChange={(e) => setAlloc({ ...alloc, [m]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  className="num min-h-11 w-full min-w-0 bg-transparent px-3 text-[15px] outline-none"
                  aria-label={`Part ${NOM_MODE[m]}`}
                />
                <span className="pr-3 text-doux">%</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className={cx("num text-[13px]", totalAlloc === 100 ? "text-doux" : "text-negatif")}>Total : {totalAlloc} %</span>
          <Bouton
            className="min-h-10"
            disabled={totalAlloc !== 100 || MODES.every((m) => alloc[m] === r.allocation[m])}
            onClick={() => {
              majReglages({ allocation: alloc });
              ajouterMouvement({ id: uid(), date: new Date().toISOString(), type: "reequilibrage", montant: 0 });
              notifier("Répartition enregistrée et poches rééquilibrées.", "succes");
            }}
          >
            Enregistrer et rééquilibrer
          </Bouton>
        </div>
      </Carte>

      <Carte>
        <Titre sous="Quand une limite est atteinte, Pilote arrête de proposer des mises jusqu'au lendemain (ou à la fin de la semaine).">Garde-fous</Titre>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ChampNombre label="Perte max par jour" valeur={r.stopLossJour} min={0} max={100} suffixe="%" onCommit={(v) => majReglages({ stopLossJour: v })} aide={`≈ ${eur((bk.total * r.stopLossJour) / 100)}`} />
          <ChampNombre label="Perte max sur 7 jours" valeur={r.stopLossSemaine} min={0} max={100} suffixe="%" onCommit={(v) => majReglages({ stopLossSemaine: v })} aide={`≈ ${eur((bk.total * r.stopLossSemaine) / 100)}`} />
          <ChampNombre label="Argent en jeu max" valeur={r.expositionMax} min={1} max={100} suffixe="%" onCommit={(v) => majReglages({ expositionMax: v })} aide={`≈ ${eur((bk.total * r.expositionMax) / 100)} engagés en même temps`} />
        </div>
        <div className="mt-4 border-t border-ligne pt-4">
          <div className="mb-2 text-[13px] font-medium text-doux">Faire une pause volontaire</div>
          {pause ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px]">En pause jusqu&apos;au {dateLongue(pause)}.</span>
              <Bouton variante="contour" className="min-h-10" onClick={() => majReglages({ pause: null })}>
                Reprendre
              </Bouton>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {[
                [1, "24 h"],
                [7, "7 jours"],
                [30, "30 jours"],
              ].map(([j, l]) => (
                <Bouton key={l} variante="contour" className="min-h-10" onClick={() => majReglages({ pause: new Date(Date.now() + (j as number) * 86_400_000).toISOString() })}>
                  {l}
                </Bouton>
              ))}
            </div>
          )}
          <p className="mt-2 text-[12px] text-faible">
            Pour une interdiction réelle et contrôlée, Winamax propose l&apos;auto-exclusion dans ton compte, et l&apos;ANJ gère le fichier national d&apos;interdiction de jeux.
          </p>
        </div>
      </Carte>

      <Carte>
        <Titre sous="Les critères qu'un pari doit remplir pour être proposé en mode Classique.">Filtres du mode Classique</Titre>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ChampNombre label="Cote minimum" valeur={r.classique.coteMin} min={1.01} max={r.classique.coteMax} onCommit={(v) => majReglages({ classique: { ...r.classique, coteMin: v } })} />
          <ChampNombre label="Cote maximum" valeur={r.classique.coteMax} min={r.classique.coteMin} max={50} onCommit={(v) => majReglages({ classique: { ...r.classique, coteMax: v } })} />
          <ChampNombre label="Indice minimum" valeur={r.classique.confianceMin} min={50} max={99} onCommit={(v) => majReglages({ classique: { ...r.classique, confianceMin: v } })} />
          <ChampNombre
            label="Avantage minimum"
            valeur={Math.round(r.classique.edgeMin * 1000) / 10}
            min={0}
            max={20}
            suffixe="%"
            onCommit={(v) => majReglages({ classique: { ...r.classique, edgeMin: v / 100 } })}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ChampNombre label="Mise minimum acceptée" valeur={r.miseMin} min={0.01} suffixe="€" onCommit={(v) => majReglages({ miseMin: v })} aide="Vérifie le minimum appliqué par Winamax." />
          <ChampNombre label="Arrondi des mises" valeur={r.arrondi} min={0.01} max={10} suffixe="€" onCommit={(v) => majReglages({ arrondi: v })} />
        </div>
      </Carte>

      <div id="sports" className="scroll-mt-20">
        <Carte>
          <Titre sous={source === "live" ? `Coût d'une actualisation : ${cout} crédit${cout > 1 ? "s" : ""} (compétitions × marchés).` : "Les compétitions analysées par Pilote."}>Compétitions et marchés</Titre>
          <div className="flex flex-wrap gap-2">
            {CATALOGUE.map((s) => {
              const actif = r.sports.includes(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => toggleSport(s.key)}
                  aria-pressed={actif}
                  className={cx("min-h-10 rounded-xl border px-3 text-[13px] font-medium transition", actif ? "border-texte bg-surface-3 text-texte" : "border-ligne text-doux hover:text-texte")}
                >
                  {s.emoji} {s.titre}
                </button>
              );
            })}
          </div>
          {source === "live" && autres.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[13px] font-medium text-doux hover:text-texte">Autres compétitions disponibles ({autres.length})</summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {autres.map((s) => {
                  const actif = r.sports.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggleSport(s.key)}
                      aria-pressed={actif}
                      className={cx("min-h-9 rounded-xl border px-3 text-[12px] transition", actif ? "border-texte bg-surface-3" : "border-ligne text-doux hover:text-texte")}
                    >
                      {emojiSport(s.key)} {s.title}
                    </button>
                  );
                })}
              </div>
            </details>
          )}
          <div className="mt-4 space-y-2 border-t border-ligne pt-4">
            {MARCHES.map((m) => (
              <div key={m.k} className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[14px] font-medium">{m.l}</div>
                  <div className="text-[12px] text-doux">{m.d}</div>
                </div>
                <Interrupteur
                  actif={r.marches.includes(m.k)}
                  label={m.l}
                  onChange={(v) => {
                    const marches = v ? [...r.marches, m.k] : r.marches.filter((x) => x !== m.k);
                    if (marches.length) majReglages({ marches });
                  }}
                />
              </div>
            ))}
          </div>
          <Bouton variante="contour" className="mt-4 w-full" onClick={() => rafraichir(true)}>
            Recharger les cotes avec ces réglages
          </Bouton>
        </Carte>
      </div>

      <div id="donnees" className="scroll-mt-20">
        <Carte>
          <Titre sous={majLe ? `Dernière mise à jour ${depuis(majLe)}` : undefined}>Connexion aux cotes Winamax</Titre>
          <div className="flex items-center gap-2 text-[14px]">
            <span className={cx("size-2 rounded-full", source === "live" ? "bg-classique" : "bg-jackpot")} />
            {source === "live" ? (
              <span>
                Cotes réelles via The Odds API{quota.remaining !== null && <span className="text-doux"> · {quota.remaining} crédits restants ce mois-ci</span>}
              </span>
            ) : (
              <span>Mode démo : cotes simulées</span>
            )}
          </div>
          {erreursApi.length > 0 && (
            <div className="mt-3 flex gap-2 rounded-xl bg-negatif/10 p-3 text-[12px] text-negatif">
              <IcAlerte className="mt-0.5 shrink-0" />
              <div>
                Certaines compétitions n&apos;ont pas pu être chargées (souvent : hors saison).
                <ul className="mt-1 list-inside list-disc">
                  {erreursApi.slice(0, 5).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="mt-4 space-y-3 text-[13px] leading-relaxed text-doux">
            <p>
              <strong className="text-texte">Pourquoi pas une connexion directe au compte ?</strong> Winamax ne propose pas d&apos;API publique. Donner tes identifiants à un robot qui parie à
              ta place exposerait ton compte (et ton solde) à une fermeture. Pilote récupère donc les cotes Winamax en temps réel, calcule tout, et c&apos;est toi qui valides le pari en deux
              touches. Les résultats sont ensuite réglés automatiquement.
            </p>
            {source !== "live" && (
              <ol className="list-inside list-decimal space-y-1.5">
                <li>
                  Crée une clé gratuite sur{" "}
                  <a href="https://the-odds-api.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-texte underline underline-offset-2">
                    the-odds-api.com <IcExterne className="inline" />
                  </a>{" "}
                  (500 crédits offerts par mois).
                </li>
                <li>
                  Sur Vercel : Settings → Environment Variables → ajoute <code className="rounded bg-surface-3 px-1.5 py-0.5 text-texte">ODDS_API_KEY</code> avec ta clé, puis redéploie.
                </li>
                <li>
                  En local : crée un fichier <code className="rounded bg-surface-3 px-1.5 py-0.5 text-texte">.env.local</code> avec <code className="rounded bg-surface-3 px-1.5 py-0.5 text-texte">ODDS_API_KEY=ta_clé</code>.
                </li>
              </ol>
            )}
          </div>
        </Carte>
      </div>

      <Carte>
        <Titre sous="Tes données restent sur cet appareil. Exporte-les pour les garder ou les transférer.">Sauvegarde</Titre>
        <div className="flex flex-wrap gap-2">
          <Bouton variante="contour" onClick={exporter}>
            Exporter (.json)
          </Bouton>
          <Bouton variante="contour" onClick={() => fichier.current?.click()}>
            Importer
          </Bouton>
          <input
            ref={fichier}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const data = JSON.parse(await f.text());
                if (!data || typeof data !== "object" || !("reglages" in data)) throw new Error();
                if (confirm("Remplacer toutes les données actuelles par cette sauvegarde ?")) {
                  remplacer(data);
                  notifier("Sauvegarde importée.", "succes");
                }
              } catch {
                notifier("Fichier de sauvegarde invalide.", "alerte");
              }
              e.target.value = "";
            }}
          />
          <Bouton
            variante="danger"
            className="ml-auto"
            onClick={() => {
              if (confirm("Tout effacer (paris, réglages, historique) ? Cette action est définitive.")) {
                reinitialiser();
                notifier("Données effacées.", "info");
              }
            }}
          >
            Tout effacer
          </Bouton>
        </div>
      </Carte>
    </div>
  );
}
