"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useDonnees } from "@/lib/donnees";
import { OFFRES, ORDRE_OFFRES, prixMensuel, type Droits, type Offre } from "@/lib/offres";
import { dateLongue } from "@/lib/format";
import { Badge, Bouton, Carte, cx } from "@/components/ui";
import { IcValider } from "@/components/Icones";

const LIGNES: [string, (d: Droits) => string | boolean][] = [
  ["Paris Classique conseillés par jour", (d) => (Number.isFinite(d.parisParJour) ? String(d.parisParJour) : "Illimités")],
  ["Mise calculée selon ta bankroll, objectif, garde-fous", () => true],
  ["Plan du jour et heures de jeu", (d) => d.parisParJour > 1],
  ["Récap du matin (notification)", (d) => d.notifMatin],
  ["Notification à l'heure de jeu, validation en 1 clic", (d) => d.notifHeureJeu],
  ["Résultats en temps réel, mises recalculées", (d) => d.tempsReel],
  ["Mise relevée sur les cotes exceptionnelles", (d) => d.conviction],
  ["Analyses IA par jour", (d) => (d.analysesIAParJour ? String(d.analysesIAParJour) : false)],
  ["Suivi en direct et conseil de cash-out", (d) => d.direct],
  ["Mode Objectif cote (fun, sans accompagnement)", (d) => d.objectifCote],
  ["Mode Jackpot (fun, sans accompagnement)", (d) => d.jackpot],
  ["Synchronisation multi-appareils", (d) => d.synchro],
];

export default function Offres() {
  const { etat } = useStore();
  const { abonnement, rafraichirAbonnement, notifier } = useDonnees();
  const [attente, setAttente] = useState<Offre | "portail" | null>(null);

  // Retour du paiement Stripe.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const retour = q.get("retour");
    const sessionId = q.get("session_id");
    if (!retour) return;
    window.history.replaceState(null, "", "/offres");
    if (retour === "annule") return notifier("Paiement annulé : rien n'a été débité.", "info");
    if (sessionId) {
      fetch("/api/abonnement/confirmer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId: etat.profilId, sessionId }) })
        .then((r) => r.json())
        .then((d: { offre?: Offre; erreur?: string }) => {
          if (d.offre) notifier(`Bienvenue dans l'offre ${OFFRES[d.offre].nom} !`, "succes");
          else notifier(d.erreur ?? "Paiement reçu, activation en cours.", "info");
          rafraichirAbonnement();
        })
        .catch(() => rafraichirAbonnement());
    }
  }, [etat.profilId, notifier, rafraichirAbonnement]);

  const choisir = async (o: Offre) => {
    setAttente(o);
    try {
      const res = await fetch("/api/abonnement/paiement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId: etat.profilId, offre: o }) });
      const d = (await res.json()) as { url?: string; erreur?: string };
      if (d.url) window.location.href = d.url;
      else notifier(d.erreur ?? "Paiement indisponible.", "alerte");
    } finally {
      setAttente(null);
    }
  };

  const portail = async () => {
    setAttente("portail");
    try {
      const res = await fetch("/api/abonnement/portail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId: etat.profilId }) });
      const d = (await res.json()) as { url?: string; erreur?: string };
      if (d.url) window.location.href = d.url;
      else notifier(d.erreur ?? "Portail indisponible.", "alerte");
    } finally {
      setAttente(null);
    }
  };

  const rang = ORDRE_OFFRES.indexOf(abonnement.offre);
  const payant = abonnement.statut === "actif" && !abonnement.geste && abonnement.offre !== "decouverte";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Les offres Pilote</h1>
        <p className="text-[14px] text-doux">
          Ton offre : <span className="font-semibold text-texte">{OFFRES[abonnement.offre].nom}</span>
          {abonnement.geste === "complet" && " (accès complet offert)"}
          {payant && abonnement.finPeriode && ` · renouvellement le ${dateLongue(abonnement.finPeriode)}`}. Sans engagement, résiliable à tout moment.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ORDRE_OFFRES.map((id, i) => {
          const o = OFFRES[id];
          const actuelle = id === abonnement.offre;
          return (
            <Carte key={id} className={cx("flex flex-col", actuelle && "ring-2")} accent={o.couleur}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[17px] font-bold" style={{ color: o.couleur }}>
                  {o.nom}
                </h2>
                {actuelle ? <Badge couleur={o.couleur}>Ton offre</Badge> : id === "pro" ? <Badge couleur="#a78bfa">Conseillée</Badge> : null}
              </div>
              <p className="text-[13px] text-doux">{o.accroche}</p>
              <div className="num mt-3 text-[26px] font-bold tracking-tight">
                {o.prix === 0 ? "0 €" : `${(o.prix / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
                <span className="text-[13px] font-medium text-doux">{o.prix ? " /mois" : ""}</span>
              </div>
              <ul className="mt-3 flex-1 space-y-1.5 text-[13px]">
                {o.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <IcValider className="mt-0.5 shrink-0" style={{ color: o.couleur }} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                {actuelle ? (
                  payant ? (
                    <Bouton variante="contour" className="w-full" disabled={attente !== null} onClick={portail}>
                      {attente === "portail" ? "Ouverture…" : "Gérer ou résilier"}
                    </Bouton>
                  ) : (
                    <div className="flex min-h-11 items-center justify-center rounded-xl bg-surface-2 text-[14px] text-doux">Offre actuelle</div>
                  )
                ) : id === "decouverte" ? (
                  payant ? (
                    <Bouton variante="fantome" className="w-full" onClick={portail}>
                      Revenir à l&apos;offre gratuite
                    </Bouton>
                  ) : null
                ) : (
                  <Bouton className="w-full" couleur={o.couleur} disabled={attente !== null || !abonnement.paiement} onClick={() => (payant ? portail() : choisir(id))}>
                    {attente === id ? "Redirection…" : !abonnement.paiement ? "Bientôt disponible" : i > rang ? `Passer à ${o.nom}` : `Choisir ${o.nom}`}
                  </Bouton>
                )}
              </div>
            </Carte>
          );
        })}
      </div>

      <Carte className="!p-0 overflow-x-auto">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead>
            <tr className="border-b border-ligne text-left">
              <th className="p-3 font-medium text-doux">Fonctionnalité</th>
              {ORDRE_OFFRES.map((id) => (
                <th key={id} className="p-3 text-center font-semibold" style={{ color: OFFRES[id].couleur }}>
                  {OFFRES[id].nom}
                  <div className="text-[11px] font-normal text-doux">{prixMensuel(id)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ligne">
            {LIGNES.map(([l, f]) => (
              <tr key={l}>
                <td className="p-3">{l}</td>
                {ORDRE_OFFRES.map((id) => {
                  const v = f(OFFRES[id].droits);
                  return (
                    <td key={id} className="num p-3 text-center">
                      {v === true ? <IcValider className="inline text-positif" /> : v === false ? <span className="text-faible">—</span> : v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Carte>

      <p className="text-[12px] leading-relaxed text-faible">
        Paiement sécurisé par Stripe. Aucune offre ne garantit des gains : Pilote cherche les cotes mal ajustées et gère le risque, mais une série de pertes reste possible. Les modes
        Objectif cote et Jackpot sont à haut risque et ne sont pas accompagnés par le conseiller. Interdit aux moins de 18 ans. Pour être aidé, appelez le 09 74 75 13 13 (appel non
        surtaxé).
      </p>
    </div>
  );
}
