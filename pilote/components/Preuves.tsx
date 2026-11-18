"use client";

// Preuves Winamax : photo ou numéro du ticket d'un pari, relevé de solde mensuel.

import { useState } from "react";
import type { Pari, ReleveSolde } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useCalculs, useDonnees } from "@/lib/donnees";
import { eur, eurSigne, uid } from "@/lib/format";
import { Bouton, Champ, Modal } from "./ui";

/** Réduit une photo (1280 px, JPEG) avant l'envoi : quelques centaines de Ko au plus. */
export async function compresserImage(fichier: File): Promise<string> {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = ko;
      i.src = url;
    });
    const echelle = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * echelle);
    c.height = Math.round(img.height * echelle);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    let qualite = 0.75;
    let data = c.toDataURL("image/jpeg", qualite);
    while (data.length > 650_000 && qualite > 0.3) {
      qualite -= 0.15;
      data = c.toDataURL("image/jpeg", qualite);
    }
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function envoyerPhoto(profilId: string, id: string, fichier: File): Promise<{ url: string; empreinte: string }> {
  const image = await compresserImage(fichier);
  const res = await fetch("/api/preuve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profilId, id, image }) });
  const d = (await res.json()) as { url?: string; empreinte?: string; erreur?: string };
  if (!res.ok || !d.url || !d.empreinte) throw new Error(d.erreur ?? "Envoi impossible.");
  return { url: d.url, empreinte: d.empreinte };
}

function ChampPhoto({ onChoix, label }: { onChoix: (f: File | null) => void; label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-doux">{label}</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => onChoix(e.target.files?.[0] ?? null)}
        className="block w-full text-[13px] text-doux file:mr-3 file:min-h-10 file:rounded-xl file:border-0 file:bg-surface-3 file:px-3 file:text-[13px] file:font-semibold file:text-texte"
      />
    </label>
  );
}

/** Ajout de la preuve d'un pari : numéro du ticket Winamax et/ou photo. */
export function ModalPreuve({ pari, onFermer }: { pari: Pari | null; onFermer: () => void }) {
  const { etat, majParis } = useStore();
  const { notifier, statut } = useDonnees();
  const [numero, setNumero] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);
  if (!pari) return null;
  const serveur = statut?.stockage !== "memoire";

  const valider = async () => {
    setEnvoi(true);
    try {
      let p = { ...(pari.preuve ?? {}), ...(numero.trim() ? { numero: numero.trim().slice(0, 60) } : {}), ajouteeLe: new Date().toISOString() };
      if (photo) {
        const { url, empreinte } = await envoyerPhoto(etat.profilId, pari.id, photo);
        p = { ...p, photo: url, empreinte };
      }
      majParis([{ ...pari, preuve: p }]);
      notifier("Preuve ajoutée au pari.", "succes");
      setNumero("");
      setPhoto(null);
      onFermer();
    } catch (e) {
      notifier((e as Error).message, "alerte");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modal ouvert onFermer={onFermer} titre="Preuve Winamax">
      <p className="text-[14px] text-doux">
        Ajoute le numéro du ticket (Winamax → Mes paris) et/ou une photo du ticket : la preuve que le pari a vraiment été joué. Sur le compte public, elle apparaît dans
        Résultats et son empreinte est inscrite dans le journal.
      </p>
      <div className="mt-4 space-y-3">
        <Champ label="Numéro du ticket" placeholder="ex. 123456789" value={numero} onChange={(e) => setNumero(e.target.value)} />
        {serveur ? <ChampPhoto label="Photo ou capture du ticket" onChoix={setPhoto} /> : <p className="text-[12px] text-faible">Photo indisponible : pas de stockage serveur configuré.</p>}
        {pari.preuve && (
          <p className="text-[12px] text-faible">
            Preuve actuelle : {pari.preuve.numero ? `ticket n°${pari.preuve.numero}` : ""}
            {pari.preuve.photo ? `${pari.preuve.numero ? " · " : ""}photo jointe` : ""}
          </p>
        )}
        <Bouton className="w-full" couleur="#34d399" disabled={envoi || (!numero.trim() && !photo)} onClick={valider}>
          {envoi ? "Envoi…" : "Enregistrer la preuve"}
        </Bouton>
      </div>
    </Modal>
  );
}

/** Relevé de solde : le solde affiché par Winamax, comparé au disponible calculé par Pilote. */
export function FormReleve() {
  const { etat, ajouterReleve, ajouterMouvement } = useStore();
  const { notifier, statut } = useDonnees();
  const { bk } = useCalculs();
  const [solde, setSolde] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [dernier, setDernier] = useState<ReleveSolde | null>(null);
  const s = Number(solde.replace(",", "."));
  const releves = etat.releves ?? [];
  const ceMois = releves.some((r) => r.date.slice(0, 7) === new Date().toISOString().slice(0, 7));

  const valider = async () => {
    setEnvoi(true);
    try {
      const id = uid();
      let r: ReleveSolde = { id, date: new Date().toISOString(), soldeWinamax: s, soldePilote: Math.round(bk.disponible * 100) / 100 };
      if (photo) {
        const { url, empreinte } = await envoyerPhoto(etat.profilId, id, photo);
        r = { ...r, photo: url, empreinte };
      }
      ajouterReleve(r);
      setDernier(r);
      setSolde("");
      setPhoto(null);
      notifier("Relevé enregistré.", "succes");
    } catch (e) {
      notifier((e as Error).message, "alerte");
    } finally {
      setEnvoi(false);
    }
  };
  const ecart = dernier ? Math.round((dernier.soldeWinamax - dernier.soldePilote) * 100) / 100 : 0;

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-doux">
        Une fois par mois, note le solde affiché par Winamax {statut?.stockage !== "memoire" ? "avec une capture d'écran" : ""} : il est comparé au solde calculé par Pilote ({eur(bk.disponible)}{" "}
        disponibles, hors mises en cours).
        {!ceMois && <span className="text-jackpot"> Pas encore de relevé ce mois-ci.</span>}
      </p>
      <Champ label="Solde affiché sur Winamax" inputMode="decimal" value={solde} onChange={(e) => setSolde(e.target.value)} suffixe="€" />
      {statut?.stockage !== "memoire" && <ChampPhoto label="Capture d'écran du solde" onChoix={setPhoto} />}
      <Bouton className="w-full" disabled={envoi || !(s >= 0) || solde === ""} onClick={valider}>
        {envoi ? "Envoi…" : "Enregistrer le relevé"}
      </Bouton>
      {dernier && ecart !== 0 && (
        <div className="rounded-xl bg-jackpot/10 p-3 text-[13px] text-jackpot">
          Écart de {eurSigne(ecart)} avec Pilote.{" "}
          <button
            className="font-semibold underline"
            onClick={() => {
              ajouterMouvement({ id: uid(), date: new Date().toISOString(), type: "ajustement", montant: ecart, note: `Alignement sur le relevé Winamax du ${new Date(dernier.date).toLocaleDateString("fr-FR")}` });
              setDernier(null);
              notifier("Solde corrigé.", "succes");
            }}
          >
            Corriger le solde de Pilote
          </button>
        </div>
      )}
      {releves.length > 0 && (
        <ul className="divide-y divide-ligne text-[13px]">
          {[...releves].reverse().slice(0, 6).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2">
              <span className="text-doux">{new Date(r.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span>
              <span className="num">
                Winamax {eur(r.soldeWinamax)} · Pilote {eur(r.soldePilote)}
                {r.photo && (
                  <a href={r.photo} target="_blank" rel="noopener noreferrer" className="ml-2 text-objectif underline">
                    capture
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
