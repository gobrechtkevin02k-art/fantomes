import Link from "next/link";

export default function Commencer() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <h1 className="font-serif text-4xl font-extrabold">C'est presque prêt.</h1>
      <p className="mt-4">Les trois questions arrivent à la prochaine étape.</p>
      <Link href="/" className="mt-8 underline underline-offset-4">Retour à l'accueil</Link>
    </main>
  );
}
