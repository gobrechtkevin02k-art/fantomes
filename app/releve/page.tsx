import Link from "next/link";

export default function Releve() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <h1 className="font-serif text-4xl font-extrabold">Ton relevé, bientôt.</h1>
      <p className="mt-4">Le dépôt du fichier et la liste de tes fantômes arrivent à l'étape 3.</p>
      <Link href="/" className="mt-8 underline underline-offset-4">Retour à l'accueil</Link>
    </main>
  );
}
