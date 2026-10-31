import Link from "next/link";

const lignes = [
  { nom: "STREAMING PLUS", mois: "9,99", an: "119,88" },
  { nom: "APPLI SPORT PREMIUM", mois: "4,99", an: "59,88" },
  { nom: "CLOUD 200 GO", mois: "2,99", an: "35,88" },
];

const benefices = [
  ["Tu déposes ton relevé", "Un fichier CSV exporté depuis ton appli bancaire. Il reste sur ton téléphone : rien n'est envoyé nulle part."],
  ["Tu vois ce que chaque abonnement coûte par an", "Pas par mois : c'est le chiffre annuel qui fait réagir. La liste est classée du plus cher au moins cher."],
  ["Tu résilies en un clic de copier-coller", "Une lettre de résiliation prête à envoyer pour chaque abonnement oublié."],
];

export default function Accueil() {
  return (
    <div className="pb-28 md:pb-0">
      <main className="mx-auto max-w-2xl px-6 pt-10 md:pt-20">
        <p className="font-serif text-xl font-semibold">Fantômes</p>

        <h1 className="mt-10 font-serif text-[2.6rem] font-extrabold leading-[1.05] md:text-6xl">
          Tu paies des abonnements que tu n'utilises plus.
        </h1>
        <p className="mt-6 max-w-md">
          Dépose ton relevé bancaire. On retrouve les prélèvements oubliés et on te dit ce qu'ils te coûtent par an.
        </p>

        <Link href="/commencer" className="mt-8 hidden w-full items-center justify-center bg-braise px-6 py-4 text-center text-xl font-extrabold text-encre md:inline-flex md:w-auto">
          Commencer, c'est gratuit
        </Link>

        <section aria-label="Exemple de relevé" className="mt-14 bg-sable p-5">
          <p className="text-sm">Exemple de relevé : trois petits prélèvements oubliés</p>
          <ul className="mt-4 divide-y divide-encre/20">
            {lignes.map((l) => (
              <li key={l.nom} className="flex items-baseline justify-between gap-3 py-3">
                <span className="text-sm font-semibold">{l.nom}</span>
                <span className="chiffre text-right">
                  <span className="text-sm line-through decoration-1">{l.mois} €/mois</span>
                  <span className="ml-3 font-extrabold text-braise">{l.an} €/an</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="chiffre mt-4 border-t-2 border-encre pt-4 font-serif text-4xl font-extrabold">
            215,64 € <span className="text-base font-semibold">partis cette année</span>
          </p>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl font-extrabold leading-tight">Petits prélèvements, grosse addition.</h2>
          <p className="mt-4 max-w-md">
            Un essai jamais résilié, un service remplacé, une option activée une fois. Chaque ligne est trop petite pour qu'on la remarque, et elle tourne des années.
          </p>
          <dl className="mt-8 divide-y divide-encre/20 border-y border-encre/20">
            {benefices.map(([titre, texte]) => (
              <div key={titre} className="py-5">
                <dt className="font-serif text-xl font-semibold">{titre}</dt>
                <dd className="mt-1 max-w-md">{texte}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-16">
          <p className="font-serif text-2xl font-semibold">Deux minutes, aucun compte à créer pour commencer.</p>
          <Link href="/commencer" className="mt-6 inline-flex w-full items-center justify-center bg-braise px-6 py-4 text-xl font-extrabold text-encre md:w-auto">
            Commencer, c'est gratuit
          </Link>
        </section>
      </main>

      <footer className="mx-auto mt-20 max-w-2xl border-t border-encre/20 px-6 py-8 text-sm">
        <p className="font-semibold">Mentions légales</p>
        <p className="mt-2">
          Éditeur : [À COMPLÉTER : nom ou raison sociale], entrepreneur individuel, SIRET [À COMPLÉTER]<br />
          Adresse : [À COMPLÉTER]<br />
          Contact : [À COMPLÉTER : email]<br />
          Hébergeur : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis
        </p>
        <p className="mt-4">CGV et politique de confidentialité : à venir avant l'ouverture des paiements.</p>
      </footer>

      <div className="fixed inset-x-0 bottom-0 border-t-2 border-encre bg-creme p-3 md:hidden">
        <Link href="/commencer" className="flex w-full items-center justify-center bg-braise px-6 py-4 text-xl font-extrabold text-encre">
          Commencer, c'est gratuit
        </Link>
      </div>
    </div>
  );
}
