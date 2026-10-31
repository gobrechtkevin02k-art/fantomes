import Link from "next/link";

export default function Offre() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <h1 className="font-serif text-4xl font-extrabold">Le paiement arrive.</h1>
      <p className="mt-4">L'écran d'offre et le paiement sécurisé sont à l'étape 4.</p>
      <Link href="/releve" className="mt-8 underline underline-offset-4">Retour à ma liste</Link>
    </main>
  );
}
