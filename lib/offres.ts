export const CONTACT = "[À COMPLÉTER : email]";

export type Plan = "unique" | "mensuel" | "annuel";

export const OFFRES: Record<Plan, { nom: string; montant: number; mode: "payment" | "subscription"; interval?: "month" | "year" }> = {
  unique: { nom: "Audit complet", montant: 1900, mode: "payment" },
  mensuel: { nom: "Suivi mensuel", montant: 900, mode: "subscription", interval: "month" },
  annuel: { nom: "Suivi annuel", montant: 7900, mode: "subscription", interval: "year" },
};
