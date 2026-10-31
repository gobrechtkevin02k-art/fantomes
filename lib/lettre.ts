import type { Prelevement } from "./detect";

const jour = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function lettre(p: Prelevement, nom: string, adresse: string): string {
  const montant = p.mensuel.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${nom || "[Ton prénom et ton nom]"}
${adresse || "[Ton adresse]"}

${p.nom}
Service client, résiliation

Fait le ${jour(new Date())}

Objet : résiliation de mon abonnement (numéro de client : [À COMPLÉTER])

Madame, Monsieur,

Je vous informe par la présente de ma décision de résilier, dès réception de ce courrier, l'abonnement que j'ai souscrit auprès de vos services. Vous prélevez ${montant} € par mois à ce titre (dernier prélèvement constaté le ${jour(new Date(p.dernier))}).

Je vous demande de :
- me confirmer la résiliation par écrit, en précisant la date à laquelle elle prend effet ;
- cesser tout prélèvement à compter de cette date ;
- m'indiquer sans délai si un engagement ou un préavis restait en cours.

Je vous demande également de ne plus utiliser le mandat de prélèvement SEPA associé à cet abonnement.

Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.

${nom || "[Ton nom]"}`;
}
