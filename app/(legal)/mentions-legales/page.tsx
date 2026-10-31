import { CONTACT, EDITEUR } from "@/lib/offres";

export const metadata = { title: "Mentions légales — Fantômes" };

export default function Page() {
  return (
    <>
      <h1>Mentions légales</h1>
      <h2>Éditeur du site</h2>
      <p>
        {EDITEUR.nom}, {EDITEUR.statut}<br />
        SIRET : {EDITEUR.siret}<br />
        Adresse : {EDITEUR.adresse}<br />
        Email : {CONTACT}
      </p>
      <p>TVA non applicable, article 293 B du Code général des impôts.</p>
      <h2>Directeur de la publication</h2>
      <p>{EDITEUR.nom}</p>
      <h2>Hébergeur</h2>
      <p>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.</p>
      <h2>Propriété intellectuelle</h2>
      <p>Les textes, le design et le code de Fantômes appartiennent à l'éditeur. Toute reproduction sans autorisation est interdite.</p>
      <h2>Médiation de la consommation</h2>
      <p>
        Conformément au Code de la consommation, tu peux recourir gratuitement à un médiateur de la consommation en cas de litige non résolu avec nous : [À COMPLÉTER : nom et coordonnées du médiateur].
      </p>
      <p>Dernière mise à jour : 31 octobre 2026.</p>
    </>
  );
}
