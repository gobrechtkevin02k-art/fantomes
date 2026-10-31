import { CONTACT, EDITEUR } from "@/lib/offres";

export const metadata = { title: "Politique de confidentialité — Fantômes" };

export default function Page() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <h2>Qui est responsable</h2>
      <p>{EDITEUR.nom}, {EDITEUR.adresse}. Contact : {CONTACT}.</p>
      <h2>Ton relevé bancaire</h2>
      <p>Le fichier que tu déposes est lu et analysé dans ton navigateur. Il n'est pas envoyé à nos serveurs et nous n'en gardons aucune copie. Le résultat de l'analyse reste dans la mémoire temporaire de ton navigateur, qui se vide à la fermeture de l'onglet.</p>
      <h2>Ce que nous traitons</h2>
      <ul>
        <li>Le paiement : traité par Stripe (email, données de carte). Nous ne voyons jamais ton numéro de carte. Nous recevons de Stripe la confirmation du paiement.</li>
        <li>Un cookie technique d'accès, nécessaire pour ouvrir ta liste après achat. Il ne sert à aucun suivi publicitaire et ne demande donc pas de bandeau de consentement.</li>
        <li>Une mesure d'audience sans cookie (Vercel Analytics) : nombre de visites et pages vues, sans te suivre d'un site à l'autre.</li>
      </ul>
      <h2>Pourquoi, et combien de temps</h2>
      <p>Pour exécuter ta commande et la garantie de remboursement : les données de paiement sont conservées par Stripe selon ses règles et nos obligations comptables. La mesure d'audience est agrégée.</p>
      <h2>Destinataires et hébergement</h2>
      <p>Stripe (paiement) et Vercel (hébergement, mesure d'audience). Ces prestataires peuvent traiter des données hors de l'Union européenne, avec les garanties prévues par la réglementation.</p>
      <h2>Tes droits</h2>
      <p>Tu peux demander l'accès, la rectification ou l'effacement de tes données en écrivant à {CONTACT}. Tu peux aussi saisir la CNIL (cnil.fr) si tu estimes que tes droits ne sont pas respectés.</p>
      <p>Dernière mise à jour : 31 octobre 2026.</p>
    </>
  );
}
