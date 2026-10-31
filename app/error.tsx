"use client";

import Link from "next/link";

export default function Erreur({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <h1 className="font-serif text-4xl font-extrabold leading-tight">Quelque chose s'est mal passé.</h1>
      <p className="mt-4">Rien n'a été débité à cause de cette erreur. Réessaie, ou reviens à l'accueil : ton relevé n'a jamais quitté ton appareil.</p>
      <button onClick={reset} className="mt-8 w-full bg-braise px-6 py-4 text-xl font-extrabold text-encre md:w-fit">Réessayer</button>
      <Link href="/" className="mt-5 underline underline-offset-4">Retour à l'accueil</Link>
    </main>
  );
}
