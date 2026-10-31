"use client";

import Link from "next/link";
import { useState } from "react";

type Choix = { label: string; valeur: number };
type Question = { id: "nb" | "controle" | "mois"; titre: string; aide: string; choix: Choix[] };

const questions: Question[] = [
  {
    id: "nb",
    titre: "Combien d'abonnements crois-tu avoir ?",
    aide: "Streaming, musique, sport, applis, cloud, box, assurances optionnelles… Ta meilleure estimation suffit.",
    choix: [
      { label: "1 à 3", valeur: 2 },
      { label: "4 à 6", valeur: 5 },
      { label: "7 à 10", valeur: 8 },
      { label: "Plus de 10", valeur: 12 },
    ],
  },
  {
    id: "controle",
    titre: "Quand as-tu vérifié tes prélèvements pour la dernière fois ?",
    aide: "Ligne par ligne, sur un relevé.",
    choix: [
      { label: "Ces derniers mois", valeur: 0.1 },
      { label: "Il y a plus d'un an", valeur: 0.2 },
      { label: "Jamais vraiment", valeur: 0.3 },
    ],
  },
  {
    id: "mois",
    titre: "Combien ça te coûte par mois, au total ?",
    aide: "Tous abonnements confondus. Un ordre de grandeur suffit.",
    choix: [
      { label: "Moins de 30 €", valeur: 20 },
      { label: "30 à 60 €", valeur: 45 },
      { label: "60 à 100 €", valeur: 80 },
      { label: "Plus de 100 €", valeur: 130 },
    ],
  },
];

type Reponses = Partial<Record<Question["id"], Choix>>;

export default function Commencer() {
  const [etape, setEtape] = useState(0);
  const [rep, setRep] = useState<Reponses>({});

  const fini = etape >= questions.length;

  function choisir(q: Question, c: Choix) {
    setRep({ ...rep, [q.id]: c });
    setEtape(etape + 1);
  }

  if (fini && rep.nb && rep.controle && rep.mois) {
    const parAn = Math.round(rep.mois.valeur * rep.controle.valeur * 12);
    return (
      <main className="mx-auto min-h-dvh max-w-2xl px-6 py-10">
        <p className="font-serif text-xl font-semibold">Fantômes</p>
        <p className="mt-10">
          Tu as dit : environ {rep.nb.label.toLowerCase()} abonnements, {rep.mois.label.toLowerCase()} par mois, et un dernier contrôle « {rep.controle.label.toLowerCase()} ».
        </p>
        <h1 className="chiffre mt-4 font-serif text-5xl font-extrabold leading-[1.05]">
          Environ {parAn} € par an <span className="block text-3xl">partent dans des prélèvements que tu ne remarques plus.</span>
        </h1>
        <p className="chiffre mt-6 max-w-md">
          Sur cinq ans, ça fait {parAn * 5} €. C'est une estimation prudente, bâtie sur tes réponses : ton relevé donnera le chiffre exact.
        </p>

        <section className="mt-10 bg-sable p-5">
          <h2 className="font-serif text-2xl font-semibold">Ce que ça change avec Fantômes</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Tu vois la liste exacte des prélèvements réguliers, du plus cher par an au moins cher.</li>
            <li>Chaque abonnement oublié vient avec sa lettre de résiliation, prête à envoyer.</li>
            <li>Le total que tu récupères sur l'année se met à jour à chaque résiliation.</li>
          </ul>
        </section>

        <Link href="/releve" className="mt-8 flex w-full items-center justify-center bg-braise px-6 py-4 text-xl font-extrabold text-encre md:inline-flex md:w-auto">
          Voir mes fantômes
        </Link>
        <button onClick={() => { setRep({}); setEtape(0); }} className="mt-6 block underline underline-offset-4">
          Refaire le test
        </button>
      </main>
    );
  }

  const q = questions[etape];
  const pct = Math.round((etape / questions.length) * 100);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-6">
      <div className="flex items-center justify-between">
        {etape > 0 ? (
          <button onClick={() => setEtape(etape - 1)} className="py-2 pr-4 underline underline-offset-4">Retour</button>
        ) : (
          <Link href="/" className="py-2 pr-4 underline underline-offset-4">Accueil</Link>
        )}
        <p className="chiffre text-sm">Question {etape + 1} sur {questions.length}</p>
      </div>
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-2 w-full bg-sable">
        <div className="h-2 bg-braise" style={{ width: `${((etape + 1) / questions.length) * 100}%` }} />
      </div>

      <h1 className="mt-10 font-serif text-3xl font-extrabold leading-tight md:text-4xl">{q.titre}</h1>
      <p className="mt-3 max-w-md text-base">{q.aide}</p>

      <div className="mt-8 grid gap-3 pb-8">
        {q.choix.map((c) => (
          <button
            key={c.label}
            onClick={() => choisir(q, c)}
            className="border-2 border-encre bg-creme px-5 py-4 text-left text-xl font-semibold active:bg-braise"
          >
            {c.label}
          </button>
        ))}
      </div>
    </main>
  );
}
