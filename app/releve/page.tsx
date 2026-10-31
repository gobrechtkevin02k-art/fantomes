"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { lettre } from "@/lib/lettre";
import { detecter, exemple, lireReleve, type Prelevement } from "@/lib/detect";

const eur = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GRATUITS = 3;

function decoder(buf: ArrayBuffer): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return new TextDecoder("windows-1252").decode(buf); }
}

export default function Releve() {
  const [liste, setListe] = useState<Prelevement[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [acces, setAcces] = useState(false);
  const [cibles, setCibles] = useState<Set<string>>(new Set());
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);

  const basculer = (n: string) => setCibles((c) => { const x = new Set(c); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  async function copier(p: Prelevement) {
    try { await navigator.clipboard.writeText(lettre(p, nom, adresse)); setCopie(p.nom); setTimeout(() => setCopie(null), 2000); } catch {}
  }

  useEffect(() => {
    try {
      const l = sessionStorage.getItem("fantomes_liste");
      if (l) setListe(JSON.parse(l));
    } catch {}
    const id = new URLSearchParams(window.location.search).get("session_id");
    const verifier = () => fetch("/api/acces").then((r) => r.json()).then((d) => setAcces(!!d.acces)).catch(() => {});
    if (id) {
      fetch("/api/acces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: id }) })
        .then(verifier).catch(() => {});
      window.history.replaceState(null, "", "/releve");
    } else verifier();
  }, []);

  function analyser(texte: string) {
    const lignes = lireReleve(texte);
    if ("erreur" in lignes) { setErreur(lignes.erreur); setListe(null); return; }
    const res = detecter(lignes);
    if (res.length === 0) {
      setErreur("Je n'ai trouvé aucun prélèvement régulier. Il faut au moins 3 mois de relevé, et 6 mois donnent un meilleur résultat.");
      setListe(null);
      return;
    }
    setErreur(""); setListe(res);
    try { sessionStorage.setItem("fantomes_liste", JSON.stringify(res)); } catch {}
  }

  async function surFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    analyser(decoder(await f.arrayBuffer()));
    e.target.value = "";
  }

  if (!liste) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-6">
        <Link href="/commencer" className="w-fit py-2 pr-4 underline underline-offset-4">Retour</Link>
        <h1 className="mt-8 font-serif text-4xl font-extrabold leading-tight">Dépose ton relevé.</h1>
        <p className="mt-4 max-w-md">
          Un fichier CSV exporté depuis le site ou l'appli de ta banque, sur 3 mois minimum (6 mois, c'est mieux).
        </p>
        <p className="mt-3 max-w-md bg-sable p-4 text-base">
          Ton fichier est lu sur ton appareil. Il n'est envoyé nulle part et rien n'est enregistré.
        </p>

        <label className="mt-8 flex w-full cursor-pointer items-center justify-center bg-braise px-6 py-4 text-center text-xl font-extrabold text-encre md:w-fit">
          Choisir mon fichier CSV
          <input type="file" accept=".csv,text/csv,text/plain" onChange={surFichier} className="sr-only" />
        </label>

        {erreur && <p role="alert" className="mt-5 border-2 border-braise p-4">{erreur}</p>}

        <button onClick={() => analyser(exemple())} className="mt-6 w-fit underline underline-offset-4">
          Pas de fichier sous la main ? Essayer avec un exemple
        </button>
        <p className="mt-10 max-w-md text-base">
          Où le trouver ? Dans ton espace bancaire, cherche « Exporter » ou « Télécharger » à côté de la liste de tes opérations, et choisis le format CSV.
        </p>
      </main>
    );
  }

  const total = liste.reduce((s, p) => s + p.annuel, 0);
  const nbVisibles = acces ? liste.length : GRATUITS;
  const visibles = liste.slice(0, nbVisibles);
  const verrouilles = liste.slice(nbVisibles);
  const totalVerrou = verrouilles.reduce((s, p) => s + p.annuel, 0);
  const economie = liste.filter((p) => cibles.has(p.nom)).reduce((s, p) => s + p.annuel, 0);

  return (
    <main className="mx-auto max-w-2xl px-6 pb-32 pt-6 md:pb-12">
      <button onClick={() => { setListe(null); try { sessionStorage.removeItem("fantomes_liste"); } catch {} }} className="py-2 pr-4 underline underline-offset-4">Changer de fichier</button>
      <h1 className="mt-8 font-serif text-3xl font-extrabold leading-tight md:text-4xl">
        {liste.length} prélèvements réguliers, <span className="chiffre">{eur(total)} €</span> par an.
      </h1>
      <p className="mt-4 max-w-md text-base">
        Classés par ce qu'ils coûtent sur l'année. Certains sont utiles (loyer, énergie) : repère ceux que tu n'utilises plus.
      </p>

      {acces && (
        <section className="mt-8 space-y-3">
          <div className="border-2 border-encre p-5">
            <h2 className="font-serif text-2xl font-semibold">Récupéré sur l'année</h2>
            <p aria-live="polite" className="chiffre mt-1 font-serif text-4xl font-extrabold text-braise">{eur(economie)} €</p>
            <p className="mt-1 text-base">Coche « À résilier » sur chaque abonnement que tu veux arrêter : le total se met à jour.</p>
          </div>
          <div className="bg-sable p-5">
            <h2 className="font-serif text-xl font-semibold">Pour remplir tes lettres</h2>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ton prénom et ton nom" autoComplete="name" className="mt-3 w-full border-2 border-encre bg-creme p-3" />
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Ton adresse postale" autoComplete="street-address" className="mt-3 w-full border-2 border-encre bg-creme p-3" />
            <p className="mt-3 text-base">Le nom du service vient de ton relevé : corrige-le dans la lettre si besoin. Ajoute ton numéro de client là où c'est indiqué. Si tu as souscrit en ligne, regarde aussi dans ton espace client : la résiliation s'y fait souvent en quelques clics.</p>
          </div>
        </section>
      )}

      <ul className="mt-8 border-t-2 border-encre">
        {visibles.map((p) => (
          <li key={p.nom} className="border-b border-encre/20 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span>
                <span className="block text-xl font-semibold">{p.nom}</span>
                <span className="chiffre text-base">{eur(p.mensuel)} € par mois</span>
              </span>
              <span className="chiffre font-serif text-2xl font-extrabold text-braise">{eur(p.annuel)} €<span className="text-sm font-normal text-encre"> /an</span></span>
            </div>
            {acces && (
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                <label className="flex items-center gap-2 py-1">
                  <input type="checkbox" className="h-6 w-6 accent-braise" checked={cibles.has(p.nom)} onChange={() => basculer(p.nom)} />
                  À résilier
                </label>
                <button onClick={() => setOuvert(ouvert === p.nom ? null : p.nom)} className="py-1 underline underline-offset-4">
                  {ouvert === p.nom ? "Masquer la lettre" : "Voir la lettre"}
                </button>
              </div>
            )}
            {acces && ouvert === p.nom && (
              <div className="mt-3 bg-sable p-4">
                <pre className="whitespace-pre-wrap font-sans text-base">{lettre(p, nom, adresse)}</pre>
                <button onClick={() => copier(p)} className="mt-3 border-2 border-encre bg-creme px-4 py-3 font-semibold">
                  {copie === p.nom ? "Lettre copiée" : "Copier la lettre"}
                </button>
              </div>
            )}
          </li>
        ))}
        {verrouilles.map((p, i) => (
          <li key={i} aria-hidden="true" className="flex items-baseline justify-between gap-3 border-b border-encre/20 bg-sable/60 py-4 pl-3 pr-1">
            <span className="text-xl font-semibold tracking-widest">••••••••</span>
            <span className="font-serif text-2xl font-extrabold">••• €<span className="text-sm font-normal"> /an</span></span>
          </li>
        ))}
      </ul>

      {verrouilles.length > 0 && (
        <section className="mt-8 border-2 border-encre p-5">
          <h2 className="font-serif text-2xl font-semibold">
            Il en reste {verrouilles.length}, pour <span className="chiffre">{eur(totalVerrou)} €</span> par an.
          </h2>
          <p className="mt-2">Débloque la liste complète et une lettre de résiliation prête à envoyer pour chaque abonnement.</p>
        </section>
      )}

      {acces ? (
        null
      ) : (
      <div className="fixed inset-x-0 bottom-0 border-t-2 border-encre bg-creme p-3 md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
        <Link href="/offre" className="flex w-full items-center justify-center bg-braise px-6 py-4 text-xl font-extrabold text-encre md:inline-flex md:w-auto">
          Débloquer la liste et les lettres
        </Link>
      </div>
      )}
    </main>
  );
}
