import { CONTACT, EDITEUR } from "@/lib/offres";

export const metadata = { title: "Conditions générales de vente — Fantômes" };

export default function Page() {
  return (
    <>
      <h1>Conditions générales de vente</h1>
      <h2>1. Vendeur</h2>
      <p>{EDITEUR.nom}, {EDITEUR.statut}, SIRET {EDITEUR.siret}, {EDITEUR.adresse}. Contact : {CONTACT}.</p>
      <h2>2. Service</h2>
      <p>Fantômes est un outil en ligne qui analyse un relevé bancaire au format CSV pour repérer les prélèvements mensuels réguliers, les classer par coût annuel et générer des lettres de résiliation modèles. L'analyse se fait dans ton navigateur : ton relevé n'est pas envoyé à nos serveurs.</p>
      <h2>3. Formules et prix</h2>
      <ul>
        <li>Audit complet : 19 €, paiement unique.</li>
        <li>Suivi mensuel : 9 € par mois, renouvelé chaque mois.</li>
        <li>Suivi annuel : 79 € par an, renouvelé chaque année.</li>
      </ul>
      <p>Prix en euros, TVA non applicable (article 293 B du CGI). Le paiement est traité par Stripe, par carte bancaire.</p>
      <h2>4. Livraison</h2>
      <p>L'accès est ouvert immédiatement après la confirmation du paiement, dans le navigateur utilisé pour payer.</p>
      <h2>5. Garantie satisfait ou remboursé, 14 jours</h2>
      <p>Pendant 14 jours à compter du paiement, tu peux demander le remboursement intégral, sans justification, en écrivant à {CONTACT} avec l'adresse email utilisée pour payer. Le remboursement est effectué sous 5 jours ouvrés ; ta banque peut ensuite mettre quelques jours à l'afficher. Cette garantie s'ajoute à tes droits légaux.</p>
      <h2>6. Résiliation</h2>
      <p>Les formules mensuelle et annuelle sont sans engagement. Tu peux les résilier à tout moment en écrivant à {CONTACT} : la résiliation prend effet avant le prélèvement suivant et aucun nouveau prélèvement n'est effectué. La période déjà payée reste acquise, hors garantie des 14 jours.</p>
      <h2>7. Responsabilité</h2>
      <p>Fantômes aide à repérer des prélèvements : c'est à toi de vérifier, avant de résilier, que le service concerné ne t'est pas utile. Les lettres sont des modèles courants, à relire et à adapter. Nous ne sommes pas responsables des conséquences d'une résiliation décidée par l'utilisateur.</p>
      <h2>8. Données personnelles</h2>
      <p>Voir la politique de confidentialité.</p>
      <h2>9. Droit applicable et litiges</h2>
      <p>Les présentes conditions sont soumises au droit français. En cas de litige, tu peux recourir au médiateur de la consommation indiqué dans les mentions légales.</p>
      <p>Dernière mise à jour : 31 octobre 2026.</p>
    </>
  );
}
