export const CONTACT = "Fantomes.PRO@Outlook.fr";
// Lien du portail de résiliation Stripe (mode TEST). À remplacer par le lien du mode réel à la mise en production.
export const PORTAIL = "https://billing.stripe.com/p/login/test_28E3cufFGg8d3Pn8VC1kA00";
export const EDITEUR = {
  nom: "Kevin Gobrecht",
  statut: "entrepreneur individuel (micro-entrepreneur)",
  siret: "952 144 707 00017",
  adresse: "175 B rue Georges Mandel, 02000 Laon",
};

export type Plan = "unique" | "mensuel" | "annuel";

export const OFFRES: Record<Plan, { nom: string; montant: number; mode: "payment" | "subscription"; interval?: "month" | "year" }> = {
  unique: { nom: "Audit complet", montant: 1900, mode: "payment" },
  mensuel: { nom: "Suivi mensuel", montant: 900, mode: "subscription", interval: "month" },
  annuel: { nom: "Suivi annuel", montant: 7900, mode: "subscription", interval: "year" },
};
