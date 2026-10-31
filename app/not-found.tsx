import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <h1 className="font-serif text-4xl font-extrabold leading-tight">Cette page s'est volatilisée.</h1>
      <p className="mt-4">Le lien est peut-être erroné, ou la page n'existe plus. Ça arrive aux fantômes.</p>
      <Link href="/" className="mt-8 flex w-full items-center justify-center bg-braise px-6 py-4 text-xl font-extrabold text-encre md:inline-flex md:w-fit">
        Retour à l'accueil
      </Link>
    </main>
  );
}
