import Link from "next/link";
import { CONTACT, EDITEUR, PORTAIL } from "@/lib/offres";

export default function Pied() {
  return (
    <footer className="mx-auto mt-16 max-w-2xl border-t border-encre/20 px-6 pb-28 pt-8 text-sm md:pb-10">
      <nav aria-label="Informations légales" className="flex flex-wrap gap-x-6 gap-y-2 text-base">
        <Link href="/mentions-legales" className="py-1 underline underline-offset-4">Mentions légales</Link>
        <Link href="/cgv" className="py-1 underline underline-offset-4">CGV</Link>
        <Link href="/confidentialite" className="py-1 underline underline-offset-4">Confidentialité</Link>
        <a href={PORTAIL} className="py-1 underline underline-offset-4">Gérer mon abonnement</a>
      </nav>
      <p className="mt-4">
        Fantômes, édité par {EDITEUR.nom}, {EDITEUR.statut}. Contact : {CONTACT}
      </p>
    </footer>
  );
}
