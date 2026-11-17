// Compte public : le profil désigné par PILOTE_PROFIL_PUBLIC alimente l'onglet Résultats.

import "server-only";
import type { EtatApp } from "../types";
import { chainer, differences, type Evenement } from "../transparence";
import { stockage } from "./stockage";

export const profilPublic = () => process.env.PILOTE_PROFIL_PUBLIC?.trim() || "";
export const estPublic = (id: string) => !!profilPublic() && id === profilPublic();

export const CLE_JOURNAL = "journal:public";
export const CLE_SYNCHRO = "public:derniere-synchro";

/** À appeler avant d'enregistrer une nouvelle version du compte public : ajoute les différences au journal. */
export async function journaliser(nouvel: EtatApp, precedent: EtatApp | null): Promise<number> {
  const st = stockage();
  const maintenant = Date.now();
  const journal = (await st.get<Evenement[]>(CLE_JOURNAL)) ?? [];
  // Si le journal est vide, on l'ouvre à partir de l'état complet, même si un état existait déjà.
  const ev = differences(journal.length ? precedent : null, nouvel, maintenant);
  if (ev.length) await st.set(CLE_JOURNAL, await chainer(journal, ev, maintenant));
  await st.set(CLE_SYNCHRO, new Date(maintenant).toISOString());
  return ev.length;
}
