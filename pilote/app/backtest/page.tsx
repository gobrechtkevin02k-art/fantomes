"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Profil } from "@/lib/types";
import type { ParametresBacktest, RapportBacktest } from "@/lib/backtest/types";
import { PARAMETRES_DEFAUT } from "@/lib/backtest/types";
import { calculerBankroll, statistiques } from "@/lib/engine/bankroll";
import { clvGlobal, plusGrosseBaisse } from "@/lib/engine/analyse";
import { reglagesParDefaut } from "@/lib/reglages";
import { useStore } from "@/lib/store";
import { useDonnees } from "@/lib/donnees";
import { dateLongue, eur, eurSigne, nombre, pct, pctSigne } from "@/lib/format";
import { nomSport } from "@/lib/sports";
import Graphique from "@/components/Graphique";
import { MeilleurPire, QualiteParis, StatsDetaillees } from "@/components/Analyses";
import { Badge, Barre, Bouton, Carte, Champ, Interrupteur, Puces, Stat, Titre, Vide, cx } from "@/components/ui";
import { IcAlerte, IcGraphique } from "@/components/Icones";

interface Infos {
  rapport: RapportBacktest | null;
  proprietaire: boolean;
  cotesReelles: boolean;
  sports: string[];
}

const hier = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const ilYa = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString().slice(0, 10);

function verdict(r: RapportBacktest): { titre: string; texte: string; couleur: string } {
  const n = r.paris.length;
  const clv = clvGlobal(r.paris, r.clotures);
  if (r.source === "demo")
    return { titre: "Données simulées", texte: "Ce test vérifie que toute la chaîne fonctionne. Ses chiffres ne disent rien de la réalité : lance un test sur les vraies cotes pour conclure.", couleur: "#fbbf24" };
  if (n < 100) return { titre: "Échantillon trop petit", texte: `${n} paris seulement : impossible de conclure. Élargis la période ou ajoute des championnats.`, couleur: "#8b97a4" };
  if (clv.n >= 50 && clv.moyenne > 0.01 && clv.part > 0.55)
    return {
      titre: "Signal encourageant",
      texte: `Les cotes prises battent la cote de clôture (${pctSigne(clv.moyenne)} en moyenne, ${pct(clv.part, 0)} des paris) : c'est le meilleur indicateur d'un avantage réel.${n < 500 ? " Le bénéfice reste à confirmer sur plusieurs centaines de paris de plus." : ""}`,
      couleur: "#34d399",
    };
  if (clv.n >= 50 && clv.moyenne <= 0)
    return {
      titre: "Pas d'avantage démontré",
      texte: "Les cotes prises ne battent pas la cote de clôture. Ne mise pas d'argent réel sur ces réglages : essaie d'autres seuils ou d'autres championnats, puis vérifie sur une autre période.",
      couleur: "#f87171",
    };
  return { titre: "Signal faible", texte: "Rien de net pour l'instant : à confirmer sur plus de paris ou une autre période.", couleur: "#fbbf24" };
}

function Rapport({ r }: { r: RapportBacktest }) {
  const s = useMemo(() => statistiques(r.paris), [r]);
  const clv = useMemo(() => clvGlobal(r.paris, r.clotures), [r]);
  const baisse = useMemo(() => plusGrosseBaisse(r.paris, r.parametres.bankroll), [r]);
  const courbe = useMemo(() => {
    const reglages = { ...reglagesParDefaut(), bankrollInitiale: r.parametres.bankroll, dateDebut: r.periode.du };
    return calculerBankroll({ reglages, paris: r.paris, mouvements: [] }).historique;
  }, [r]);
  const jours = Math.max(1, (Date.parse(r.periode.au) - Date.parse(r.periode.du)) / 86_400_000);
  const v = verdict(r);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-doux">
        <Badge couleur={r.source === "demo" ? "#fbbf24" : "#34d399"}>{r.source === "demo" ? "Démonstration" : "Données réelles"}</Badge>
        <span>
          Du {dateLongue(r.periode.du)} au {dateLongue(r.periode.au)} · généré le {dateLongue(r.genereLe)}
        </span>
      </div>

      <Carte accent={v.couleur}>
        <div className="text-[18px] font-bold" style={{ color: v.couleur }}>
          {v.titre}
        </div>
        <p className="mt-1 text-[14px] leading-relaxed text-doux">{v.texte}</p>
      </Carte>

      <Carte>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Résultat" valeur={eurSigne(s.profit)} grand couleur={s.profit >= 0 ? "#34d399" : "#f87171"} sous={`${eur(r.parametres.bankroll, 0)} → ${eur(r.bankrollFinale)}`} />
          <Stat label="ROI" valeur={pctSigne(s.roi)} grand couleur={s.roi >= 0 ? "#34d399" : "#f87171"} sous={`sur ${eur(s.misesReglees, 0)} misés`} />
          <Stat label="Cote de clôture battue" valeur={clv.n ? pct(clv.part, 0) : "—"} sous={clv.n ? `${pctSigne(clv.moyenne)} en moyenne` : "pas de cote de clôture"} />
          <Stat label="Plus grosse baisse" valeur={baisse.montant ? eurSigne(-baisse.montant) : "aucune"} couleur={baisse.montant ? "#f87171" : undefined} sous={baisse.pct !== null ? pctSigne(-baisse.pct) : undefined} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 border-t border-ligne pt-3 sm:grid-cols-4">
          <Stat label="Matchs analysés" valeur={nombre(r.matchs)} sous={r.matchsSansResultat ? `${r.matchsSansResultat} écartés faute de score` : undefined} />
          <Stat label="Paris joués" valeur={nombre(r.paris.length)} sous={`${(r.paris.length / jours).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} par jour`} />
          <Stat label="Réussite" valeur={pct(s.tauxReussite, 0)} sous={`${s.gagnes} gagnés · ${s.perdus} perdus`} />
          <Stat label="Championnats" valeur={String(r.sports.length)} sous={r.sports.map((x) => nomSport(x)).join(", ")} />
        </div>
      </Carte>

      <Carte>
        <Titre sous={`Bankroll simulée, départ ${eur(r.parametres.bankroll, 0)}, mêmes règles de mise que l'appli.`}>Évolution</Titre>
        <Graphique points={courbe} depart={r.parametres.bankroll} hauteur={170} />
      </Carte>

      <QualiteParis paris={r.paris} clotures={r.clotures} />
      <MeilleurPire paris={r.paris} tz="Europe/Paris" depart={r.parametres.bankroll} />
      <StatsDetaillees paris={r.paris} tz="Europe/Paris" />

      <Carte>
        <Titre>Ce qu&apos;un test sur l&apos;historique ne dit pas</Titre>
        <ul className="list-inside list-disc space-y-1.5 text-[13px] leading-relaxed text-doux">
          <li>Il est souvent plus optimiste que la réalité : pas de limitation de compte par Winamax, cote prise exactement au moment du relevé, aucune erreur de saisie.</li>
          <li>Ajuster les réglages jusqu&apos;à trouver un beau résultat sur le passé, c&apos;est « coller » au hasard : vérifie toujours les mêmes réglages sur une autre période.</li>
          <li>Le chiffre le plus fiable est la cote de clôture battue ; le bénéfice demande des centaines de paris pour être significatif.</li>
          <li>Les résultats passés ne préjugent pas des résultats futurs.</li>
        </ul>
      </Carte>
    </div>
  );
}

function Lancer({ infos, onRapport }: { infos: Infos; onRapport: (r: RapportBacktest) => void }) {
  const { etat } = useStore();
  const { notifier } = useDonnees();
  const [source, setSource] = useState<"reel" | "demo">(infos.cotesReelles ? "reel" : "demo");
  const [sports, setSports] = useState<string[]>(["soccer_france_ligue_one", "soccer_epl"]);
  const [du, setDu] = useState(ilYa(91));
  const [au, setAu] = useState(hier());
  const [decision, setDecision] = useState<"matin" | "avant">("matin");
  const [marches, setMarches] = useState<"h2h" | "tous">("h2h");
  const [p, setP] = useState<ParametresBacktest>(infos.rapport?.parametres ?? PARAMETRES_DEFAUT);
  const [estimation, setEstimation] = useState<number | null>(null);
  const [avance, setAvance] = useState<{ fait: number; total: number; credits: number; restants: number | null } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const stop = useRef(false);
  const options = { decision, heuresAvant: 2, marches: marches === "h2h" ? ["h2h"] : ["h2h", "totals"] };

  const appeler = async (corps: object) => {
    const res = await fetch("/api/backtest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId: etat.profilId, ...corps }) });
    const d = (await res.json()) as { erreur?: string } & Record<string, unknown>;
    if (!res.ok) throw new Error(d.erreur ?? `Erreur ${res.status}`);
    return d;
  };

  useEffect(() => {
    if (source !== "reel" || !sports.length) return setEstimation(null);
    const t = setTimeout(() => {
      appeler({ action: "estimer", sports, du, au, options })
        .then((d) => setEstimation(d.credits as number))
        .catch(() => setEstimation(null));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, sports.join(","), du, au, decision, marches]);

  const lancer = async () => {
    setEnCours(true);
    stop.current = false;
    try {
      if (source === "demo") {
        const d = await appeler({ action: "demo", parametres: p });
        onRapport(d.rapport as RapportBacktest);
        notifier("Test de démonstration terminé.", "succes");
        return;
      }
      const { jours } = (await appeler({ action: "estimer", sports, du, au, options })) as unknown as { jours: string[] };
      const total = jours.length * sports.length;
      let fait = 0;
      let credits = 0;
      let restants: number | null = null;
      setAvance({ fait, total, credits, restants });
      for (const jour of jours) {
        for (const sport of sports) {
          if (stop.current) throw new Error("Collecte interrompue : relance-la, les jours déjà collectés ne sont pas refacturés.");
          const r = (await appeler({ action: "collecter", sport, jour, options })) as unknown as { credits: number; restants: number | null };
          fait++;
          credits += r.credits;
          restants = r.restants;
          setAvance({ fait, total, credits, restants });
        }
      }
      const d = await appeler({ action: "executer", sports, du, au, parametres: p });
      onRapport(d.rapport as RapportBacktest);
      notifier("Test terminé.", "succes");
    } catch (e) {
      notifier((e as Error).message, "alerte");
    } finally {
      setEnCours(false);
    }
  };

  const relancer = async () => {
    setEnCours(true);
    try {
      const d = await appeler(source === "demo" ? { action: "demo", parametres: p } : { action: "executer", sports, du, au, parametres: p });
      onRapport(d.rapport as RapportBacktest);
      notifier("Test relancé avec ces réglages.", "succes");
    } catch (e) {
      notifier((e as Error).message, "alerte");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Carte accent="#a78bfa">
      <Titre sous="Rejoue exactement ce que Pilote aurait fait, jour après jour, sur des matchs déjà joués.">Lancer un test</Titre>
      <Puces
        label="Données"
        valeur={source}
        onChange={setSource}
        couleur="#a78bfa"
        options={[
          { v: "reel", l: "Vraies cotes passées" },
          { v: "demo", l: "Démonstration" },
        ]}
      />
      {source === "reel" ? (
        <div className="mt-4 space-y-4">
          {!infos.cotesReelles && (
            <p className="flex gap-2 rounded-xl bg-alerte/10 p-3 text-[12px] text-alerte">
              <IcAlerte className="mt-0.5 shrink-0" />
              Il faut une clé The Odds API avec une offre payante (l&apos;historique n&apos;est pas inclus dans l&apos;offre gratuite).
            </p>
          )}
          <div>
            <div className="mb-2 text-[13px] font-medium text-doux">Championnats (scores fournis par football-data.co.uk)</div>
            <div className="flex flex-wrap gap-2">
              {infos.sports.map((s) => {
                const actif = sports.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => setSports(actif ? sports.filter((x) => x !== s) : [...sports, s].slice(0, 6))}
                    aria-pressed={actif}
                    className={cx("min-h-10 rounded-xl border px-3 text-[13px] font-medium", actif ? "border-texte bg-surface-3" : "border-ligne text-doux")}
                  >
                    {nomSport(s)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Champ label="Du" type="date" value={du} onChange={(e) => e.target.value && setDu(e.target.value)} />
            <Champ label="Au" type="date" value={au} onChange={(e) => e.target.value && setAu(e.target.value)} />
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium text-doux">Moment de la décision</div>
            <Puces
              label="Moment de la décision"
              valeur={decision}
              onChange={setDecision}
              options={[
                { v: "matin", l: "Le matin (plan du jour)" },
                { v: "avant", l: "2 h avant chaque match" },
              ]}
            />
          </div>
          <div>
            <div className="mb-2 text-[13px] font-medium text-doux">Marchés</div>
            <Puces
              label="Marchés"
              valeur={marches}
              onChange={setMarches}
              options={[
                { v: "h2h", l: "1N2" },
                { v: "tous", l: "1N2 + plus/moins (×2 crédits)" },
              ]}
            />
          </div>
          {estimation !== null && (
            <p className="rounded-xl bg-surface-2 p-3 text-[13px] text-doux">
              Coût estimé : environ <span className="num font-semibold text-texte">{nombre(estimation)} crédits</span> The Odds API (10 crédits par relevé de cotes). Les jours déjà
              collectés ne sont jamais refacturés.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-doux">120 jours de matchs simulés : pour vérifier que tout fonctionne, sans dépenser de crédits.</p>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-[13px] font-medium text-doux">Réglages de la stratégie</summary>
        <div className="mt-3 space-y-3">
          <Puces
            label="Profil"
            valeur={p.profil}
            onChange={(v: Profil) => setP({ ...p, profil: v })}
            options={[
              { v: "prudent", l: "Prudent" },
              { v: "equilibre", l: "Équilibré" },
              { v: "offensif", l: "Offensif" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Champ label="Cote min" inputMode="decimal" value={String(p.coteMin)} onChange={(e) => setP({ ...p, coteMin: Number(e.target.value.replace(",", ".")) || p.coteMin })} />
            <Champ label="Cote max" inputMode="decimal" value={String(p.coteMax)} onChange={(e) => setP({ ...p, coteMax: Number(e.target.value.replace(",", ".")) || p.coteMax })} />
            <Champ label="Indice min" inputMode="numeric" value={String(p.confianceMin)} onChange={(e) => setP({ ...p, confianceMin: Number(e.target.value) || p.confianceMin })} />
            <Champ label="Avantage min" inputMode="decimal" suffixe="%" value={String(Math.round(p.edgeMin * 1000) / 10)} onChange={(e) => setP({ ...p, edgeMin: (Number(e.target.value.replace(",", ".")) || 0) / 100 })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px]">Le conseiller peut relever les mises</span>
            <Interrupteur actif={p.conviction} label="Mise relevée" onChange={(v) => setP({ ...p, conviction: v })} />
          </div>
          {infos.rapport && (
            <Bouton variante="contour" className="w-full" disabled={enCours} onClick={relancer}>
              Relancer le test avec ces réglages (sans recollecter)
            </Bouton>
          )}
        </div>
      </details>

      {avance && enCours && (
        <div className="mt-4 space-y-2">
          <Barre valeur={avance.fait / Math.max(1, avance.total)} couleur="#a78bfa" />
          <div className="num flex justify-between text-[12px] text-doux">
            <span>
              {avance.fait} / {avance.total} jours de championnat
            </span>
            <span>
              {nombre(avance.credits)} crédits utilisés{avance.restants !== null ? ` · ${nombre(avance.restants)} restants` : ""}
            </span>
          </div>
          <Bouton variante="fantome" className="w-full" onClick={() => (stop.current = true)}>
            Interrompre
          </Bouton>
        </div>
      )}

      <Bouton className="mt-4 w-full" couleur="#a78bfa" disabled={enCours || (source === "reel" && (!sports.length || !infos.cotesReelles))} onClick={lancer}>
        {enCours ? "Test en cours…" : source === "demo" ? "Lancer le test de démonstration" : "Collecter l'historique et lancer le test"}
      </Bouton>
    </Carte>
  );
}

export default function Backtest() {
  const { pret, etat } = useStore();
  const [infos, setInfos] = useState<Infos | null>(null);

  useEffect(() => {
    if (!pret) return;
    fetch(`/api/backtest${etat.onboarding ? `?id=${encodeURIComponent(etat.profilId)}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Infos) => setInfos(d))
      .catch(() => {});
  }, [pret, etat.onboarding, etat.profilId]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-objectif/15 text-xl text-objectif">
          <IcGraphique />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Test sur l&apos;historique</h1>
          <p className="text-[14px] text-doux">
            La méthode de Pilote rejouée sur des matchs déjà joués, avec les cotes Winamax de l&apos;époque : juste prix, indice de confiance, mises, garde-fous et cote de clôture.
          </p>
        </div>
      </div>

      {!infos ? (
        <div className="h-64 animate-pulse rounded-2xl border border-ligne bg-surface" />
      ) : (
        <>
          {infos.proprietaire && <Lancer infos={infos} onRapport={(r) => setInfos({ ...infos, rapport: r })} />}
          {infos.rapport ? (
            <Rapport r={infos.rapport} />
          ) : (
            <Vide titre="Aucun test pour l'instant" icone={<IcGraphique />}>
              {infos.proprietaire ? "Lance un premier test ci-dessus." : "Les résultats du test apparaîtront ici."}
            </Vide>
          )}
        </>
      )}
    </div>
  );
}
